import { readGithubSessionUser } from "./githubAuthService.js";
import type { GithubAuthOptions } from "./githubAuthService.js";
import { fetchOpenSourceRepository } from "./githubRepositoryService.js";

type GithubPullRequestOptions = GithubAuthOptions & {
  githubToken?: string;
};

type ParsedPullRequestUrl = {
  owner: string;
  repo: string;
  number: number;
  url: string;
};

const jsonResponse = (response: any, status: number, body: unknown) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
};

const isLoopbackRequest = (request: any) => {
  const address = request.socket?.remoteAddress || "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
};

const githubHeaders = (githubToken?: string) => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "giyeoro-pull-request-import",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
  return headers;
};

export const parseGithubPullRequestUrl = (value: unknown): ParsedPullRequestUrl | null => {
  try {
    const url = new URL(String(value || "").trim());
    const parts = url.pathname.split("/").filter(Boolean);
    if (
      url.protocol !== "https:"
      || url.hostname.toLowerCase() !== "github.com"
      || parts.length !== 4
      || parts[2] !== "pull"
      || !/^[A-Za-z0-9_.-]+$/.test(parts[0])
      || !/^[A-Za-z0-9_.-]+$/.test(parts[1])
      || !/^[1-9]\d*$/.test(parts[3])
    ) return null;

    const number = Number(parts[3]);
    if (!Number.isSafeInteger(number)) return null;

    return {
      owner: parts[0],
      repo: parts[1],
      number,
      url: `https://github.com/${parts[0]}/${parts[1]}/pull/${number}`
    };
  } catch {
    return null;
  }
};

const fetchGithubPullRequest = async (
  parsed: ParsedPullRequestUrl,
  githubToken?: string
) => {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/pulls/${parsed.number}`,
    {
      headers: githubHeaders(githubToken),
      signal: AbortSignal.timeout(20_000)
    }
  );

  if (response.status === 404) throw new Error("GITHUB_PULL_REQUEST_NOT_FOUND");
  if (response.status === 403 || response.status === 429) throw new Error("GITHUB_RATE_LIMIT");
  if (!response.ok) throw new Error("GITHUB_FETCH_FAILED");

  const data = await response.json();
  return {
    repository: data.base?.repo?.full_name || `${parsed.owner}/${parsed.repo}`,
    number: data.number,
    title: String(data.title || "").slice(0, 500),
    body: String(data.body || "").slice(0, 12_000),
    state: data.state === "closed" ? "closed" : "open",
    draft: !!data.draft,
    merged: !!data.merged,
    mergedAt: data.merged_at || null,
    closedAt: data.closed_at || null,
    author: {
      login: data.user?.login || "unknown",
      avatarUrl: data.user?.avatar_url || "",
      url: data.user?.html_url || data.html_url
    },
    url: data.html_url || parsed.url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    additions: Number.isInteger(data.additions) ? data.additions : 0,
    deletions: Number.isInteger(data.deletions) ? data.deletions : 0,
    changedFiles: Number.isInteger(data.changed_files) ? data.changed_files : 0,
    comments: Number.isInteger(data.comments) ? data.comments : 0,
    reviewComments: Number.isInteger(data.review_comments) ? data.review_comments : 0,
    headBranch: data.head?.ref || "",
    baseBranch: data.base?.ref || ""
  };
};

const errorResponse = (error: unknown): [number, string] => {
  const message = error instanceof Error ? error.message : "";
  if (message === "GITHUB_PULL_REQUEST_NOT_FOUND") return [404, "GitHub Pull Request를 찾을 수 없습니다."];
  if (message === "GITHUB_REPOSITORY_NOT_FOUND") return [404, "GitHub 저장소를 찾을 수 없습니다."];
  if (message === "GITHUB_RATE_LIMIT") return [429, "GitHub API 요청 한도에 도달했습니다."];
  if (message === "REPOSITORY_NOT_OPEN_SOURCE") {
    return [422, "공개 저장소이며 GitHub에서 라이선스가 확인되는 오픈소스 PR만 저장할 수 있습니다."];
  }
  if (message === "REPOSITORY_INACTIVE") return [422, "보관되었거나 비활성화된 저장소의 PR입니다."];
  if (error instanceof Error && (error.name === "TimeoutError" || /timeout/i.test(message))) {
    return [504, "GitHub Pull Request 조회 시간이 초과됐습니다."];
  }
  return [502, "GitHub Pull Request를 불러오지 못했습니다."];
};

export const handleGithubPullRequestRequest = async (
  request: any,
  response: any,
  options: GithubPullRequestOptions = {}
) => {
  const {
    githubToken = process.env.GITHUB_TOKEN,
    enforceLoopback = false
  } = options;

  if (enforceLoopback && !isLoopbackRequest(request)) {
    return jsonResponse(response, 403, { error: "로컬 요청만 허용됩니다." });
  }
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return jsonResponse(response, 405, { error: "GET 요청만 지원합니다." });
  }

  const user = readGithubSessionUser(request, options);
  if (!user) return jsonResponse(response, 401, { error: "GitHub 로그인이 필요합니다." });

  const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
  const parsed = parseGithubPullRequestUrl(requestUrl.searchParams.get("url"));
  if (!parsed) {
    return jsonResponse(response, 400, {
      error: "https://github.com/owner/repository/pull/번호 형식의 PR URL을 입력해 주세요."
    });
  }

  try {
    const [repository, pullRequest] = await Promise.all([
      fetchOpenSourceRepository(`${parsed.owner}/${parsed.repo}`, githubToken),
      fetchGithubPullRequest(parsed, githubToken)
    ]);

    if (pullRequest.author.login.toLowerCase() !== user.login.toLowerCase()) {
      return jsonResponse(response, 403, {
        error: `현재 로그인한 @${user.login} 계정이 작성한 PR만 저장할 수 있습니다.`
      });
    }

    return jsonResponse(response, 200, { pullRequest, repository });
  } catch (error) {
    const [status, message] = errorResponse(error);
    console.error(`[GitHub pull request] ${status}: ${message}`);
    return jsonResponse(response, status, { error: message });
  }
};
