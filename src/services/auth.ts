export type AuthUser = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
  profileUrl: string;
};

type AuthSessionResponse = {
  user: AuthUser | null;
};

const parseError = async (response: Response, fallback: string) => {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || fallback;
};

export const getGithubLoginUrl = (returnTo: string) => {
  const parameters = new URLSearchParams({ returnTo });
  return `/api/auth/github?${parameters.toString()}`;
};

export const fetchAuthSession = async (signal?: AbortSignal): Promise<AuthUser | null> => {
  const response = await fetch("/api/auth/session", {
    headers: { Accept: "application/json" },
    signal
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "GitHub 로그인 상태를 확인하지 못했습니다."));
  }

  const body = await response.json() as AuthSessionResponse;
  return body.user;
};

export const logoutGithub = async () => {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "GitHub에서 로그아웃하지 못했습니다."));
  }
};
