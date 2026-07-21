import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type GithubAuthOptions = {
  clientId?: string;
  clientSecret?: string;
  sessionSecret?: string;
  appUrl?: string;
  enforceLoopback?: boolean;
};

export type GithubUser = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
  profileUrl: string;
};

type AuthConfig = {
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
  appUrl: URL;
};

type OAuthFlowPayload = {
  state: string;
  verifier: string;
  returnTo: string;
  expiresAt: number;
};

type SessionPayload = GithubUser & {
  expiresAt: number;
};

const OAUTH_COOKIE = "giyeoro_oauth_flow";
const SESSION_COOKIE = "giyeoro_session";
const OAUTH_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const GITHUB_API_VERSION = "2022-11-28";

const jsonResponse = (response: any, status: number, body: unknown) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
};

const redirectResponse = (response: any, location: string, cookies: string[] = []) => {
  response.statusCode = 302;
  response.setHeader("Location", location);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Referrer-Policy", "no-referrer");
  if (cookies.length > 0) response.setHeader("Set-Cookie", cookies);
  response.end();
};

const isLoopbackRequest = (request: any) => {
  const address = request.socket?.remoteAddress || "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
};

const resolveConfig = (options: GithubAuthOptions = {}): AuthConfig | null => {
  const clientId = (options.clientId || process.env.GITHUB_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = (options.clientSecret || process.env.GITHUB_OAUTH_CLIENT_SECRET || "").trim();
  const sessionSecret = (options.sessionSecret || process.env.AUTH_SESSION_SECRET || "").trim();
  const appUrlValue = (options.appUrl || process.env.APP_URL || "").trim();

  if (!clientId || !clientSecret || sessionSecret.length < 32 || !appUrlValue) return null;

  try {
    const appUrl = new URL(appUrlValue);
    if (!["http:", "https:"].includes(appUrl.protocol)) return null;
    appUrl.pathname = "/";
    appUrl.search = "";
    appUrl.hash = "";
    return { clientId, clientSecret, sessionSecret, appUrl };
  } catch {
    return null;
  }
};

const parseRequestUrl = (request: any) => new URL(request.url || "/", "http://127.0.0.1");

const parseCookies = (request: any) => {
  const cookieHeader = String(request.headers?.cookie || "");
  return Object.fromEntries(cookieHeader.split(";").flatMap(entry => {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex < 0) return [];
    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    if (!key) return [];
    try {
      return [[key, decodeURIComponent(value)]];
    } catch {
      return [];
    }
  }));
};

const serializeCookie = (
  name: string,
  value: string,
  { maxAge, secure }: { maxAge: number; secure: boolean }
) => [
  `${name}=${encodeURIComponent(value)}`,
  "Path=/",
  `Max-Age=${maxAge}`,
  "HttpOnly",
  "SameSite=Lax",
  secure ? "Secure" : ""
].filter(Boolean).join("; ");

const clearCookie = (name: string, secure: boolean) => serializeCookie(name, "", {
  maxAge: 0,
  secure
});

const signPayload = (payload: unknown, secret: string, purpose: string) => {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${purpose}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
};

const verifyPayload = <T>(token: string, secret: string, purpose: string): T | null => {
  const [encodedPayload, providedSignature, ...rest] = token.split(".");
  if (!encodedPayload || !providedSignature || rest.length > 0) return null;

  const expectedSignature = createHmac("sha256", secret)
    .update(`${purpose}.${encodedPayload}`)
    .digest("base64url");
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
};

const normalizeReturnTo = (value: string | null) => {
  const candidate = String(value || "/").trim();
  if (
    !candidate.startsWith("/")
    || candidate.startsWith("//")
    || candidate.includes("\\")
    || candidate.length > 500
  ) return "/";
  return candidate;
};

const callbackUrl = (config: AuthConfig) => new URL("/api/auth/github/callback", config.appUrl).href;
const isSecure = (config: AuthConfig) => config.appUrl.protocol === "https:";

const redirectWithError = (
  response: any,
  config: AuthConfig,
  errorCode: string,
  returnTo = "/"
) => {
  const destination = new URL(normalizeReturnTo(returnTo), config.appUrl);
  destination.searchParams.set("auth_error", errorCode);
  redirectResponse(response, destination.href, [clearCookie(OAUTH_COOKIE, isSecure(config))]);
};

const githubHeaders = (accessToken: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${accessToken}`,
  "User-Agent": "giyeoro-auth",
  "X-GitHub-Api-Version": GITHUB_API_VERSION
});

const exchangeCodeForUser = async (
  code: string,
  verifier: string,
  config: AuthConfig
): Promise<GithubUser> => {
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: callbackUrl(config),
      code_verifier: verifier
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const tokenBody = await tokenResponse.json() as { access_token?: string; error?: string };
  if (!tokenResponse.ok || !tokenBody.access_token) throw new Error(tokenBody.error || "TOKEN_EXCHANGE_FAILED");

  const userResponse = await fetch("https://api.github.com/user", {
    headers: githubHeaders(tokenBody.access_token),
    signal: AbortSignal.timeout(15_000)
  });
  const userBody = await userResponse.json() as {
    id?: number;
    login?: string;
    name?: string | null;
    avatar_url?: string;
    html_url?: string;
  };
  if (!userResponse.ok || !Number.isInteger(userBody.id) || !userBody.login) {
    throw new Error("GITHUB_USER_FETCH_FAILED");
  }

  return {
    id: userBody.id as number,
    login: userBody.login,
    name: userBody.name?.trim() || userBody.login,
    avatarUrl: userBody.avatar_url || "",
    profileUrl: userBody.html_url || `https://github.com/${encodeURIComponent(userBody.login)}`
  };
};

const verifyLocalAccess = (request: any, response: any, options: GithubAuthOptions) => {
  if (!options.enforceLoopback || isLoopbackRequest(request)) return true;
  jsonResponse(response, 403, { error: "로컬 인증 API는 이 컴퓨터에서만 사용할 수 있습니다." });
  return false;
};

export const handleGithubAuthStartRequest = (request: any, response: any, options: GithubAuthOptions = {}) => {
  if (!verifyLocalAccess(request, response, options)) return;
  if (request.method !== "GET") return jsonResponse(response, 405, { error: "GET 요청만 지원합니다." });

  const config = resolveConfig(options);
  if (!config) return jsonResponse(response, 503, { error: "GitHub 로그인 환경변수가 올바르게 설정되지 않았습니다." });

  const requestUrl = parseRequestUrl(request);
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const flow: OAuthFlowPayload = {
    state,
    verifier,
    returnTo: normalizeReturnTo(requestUrl.searchParams.get("returnTo")),
    expiresAt: Date.now() + OAUTH_TTL_SECONDS * 1000
  };
  const flowCookie = serializeCookie(
    OAUTH_COOKIE,
    signPayload(flow, config.sessionSecret, "oauth-flow"),
    { maxAge: OAUTH_TTL_SECONDS, secure: isSecure(config) }
  );
  const authorizationUrl = new URL("https://github.com/login/oauth/authorize");
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", callbackUrl(config));
  authorizationUrl.searchParams.set("scope", "read:user");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", challenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  return redirectResponse(response, authorizationUrl.href, [flowCookie]);
};

export const handleGithubAuthCallbackRequest = async (
  request: any,
  response: any,
  options: GithubAuthOptions = {}
) => {
  if (!verifyLocalAccess(request, response, options)) return;
  if (request.method !== "GET") return jsonResponse(response, 405, { error: "GET 요청만 지원합니다." });

  const config = resolveConfig(options);
  if (!config) return jsonResponse(response, 503, { error: "GitHub 로그인 환경변수가 올바르게 설정되지 않았습니다." });

  const requestUrl = parseRequestUrl(request);
  const cookies = parseCookies(request);
  const flow = verifyPayload<OAuthFlowPayload>(cookies[OAUTH_COOKIE] || "", config.sessionSecret, "oauth-flow");
  const returnTo = flow?.returnTo || "/";

  if (requestUrl.searchParams.get("error")) {
    return redirectWithError(response, config, "access_denied", returnTo);
  }

  const code = requestUrl.searchParams.get("code") || "";
  const returnedState = requestUrl.searchParams.get("state") || "";
  if (
    !flow
    || flow.expiresAt < Date.now()
    || !code
    || !returnedState
    || returnedState !== flow.state
  ) {
    return redirectWithError(response, config, "invalid_flow", returnTo);
  }

  try {
    const user = await exchangeCodeForUser(code, flow.verifier, config);
    const session: SessionPayload = {
      ...user,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000
    };
    const sessionCookie = serializeCookie(
      SESSION_COOKIE,
      signPayload(session, config.sessionSecret, "session"),
      { maxAge: SESSION_TTL_SECONDS, secure: isSecure(config) }
    );
    const destination = new URL(flow.returnTo, config.appUrl);
    return redirectResponse(response, destination.href, [
      clearCookie(OAUTH_COOKIE, isSecure(config)),
      sessionCookie
    ]);
  } catch {
    return redirectWithError(response, config, "github_failed", returnTo);
  }
};

export const handleGithubSessionRequest = (request: any, response: any, options: GithubAuthOptions = {}) => {
  if (!verifyLocalAccess(request, response, options)) return;
  if (request.method !== "GET") return jsonResponse(response, 405, { error: "GET 요청만 지원합니다." });

  const config = resolveConfig(options);
  if (!config) return jsonResponse(response, 503, { error: "GitHub 로그인 환경변수가 올바르게 설정되지 않았습니다." });

  const cookies = parseCookies(request);
  const session = verifyPayload<SessionPayload>(cookies[SESSION_COOKIE] || "", config.sessionSecret, "session");
  if (!session || session.expiresAt < Date.now()) {
    response.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE, isSecure(config)));
    return jsonResponse(response, 200, { user: null });
  }

  const { expiresAt: _expiresAt, ...user } = session;
  return jsonResponse(response, 200, { user });
};

export const readGithubSessionUser = (
  request: any,
  options: GithubAuthOptions = {}
): GithubUser | null => {
  const config = resolveConfig(options);
  if (!config) return null;

  const cookies = parseCookies(request);
  const session = verifyPayload<SessionPayload>(
    cookies[SESSION_COOKIE] || "",
    config.sessionSecret,
    "session"
  );
  if (
    !session
    || session.expiresAt < Date.now()
    || !Number.isInteger(session.id)
    || !/^[A-Za-z0-9-]{1,39}$/.test(session.login)
  ) return null;

  const { expiresAt: _expiresAt, ...user } = session;
  return user;
};

export const handleGithubLogoutRequest = (request: any, response: any, options: GithubAuthOptions = {}) => {
  if (!verifyLocalAccess(request, response, options)) return;
  if (request.method !== "POST") return jsonResponse(response, 405, { error: "POST 요청만 지원합니다." });

  const config = resolveConfig(options);
  if (!config) return jsonResponse(response, 503, { error: "GitHub 로그인 환경변수가 올바르게 설정되지 않았습니다." });

  const origin = String(request.headers?.origin || "");
  if (origin && origin !== config.appUrl.origin) {
    return jsonResponse(response, 403, { error: "허용되지 않은 로그아웃 요청입니다." });
  }

  response.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE, isSecure(config)));
  return jsonResponse(response, 200, { ok: true });
};
