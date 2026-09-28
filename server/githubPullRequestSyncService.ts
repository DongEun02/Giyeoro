import { sql } from "drizzle-orm";
import { getDatabase } from "./database.js";
import { readGithubSessionUser } from "./githubAuthService.js";
import type { GithubAuthOptions, GithubUser } from "./githubAuthService.js";
import {
  listWorkspaceItems,
  upsertWorkspaceItem,
  upsertWorkspaceUser
} from "./workspaceService.js";
import type { WorkspaceItem } from "./workspaceService.js";

type PullRequestSyncOptions = GithubAuthOptions & {
  databaseUrl?: string;
  githubToken?: string;
};

type PullRequestNode = {
  number?: number;
  title?: string;
  bodyText?: string;
  state?: "OPEN" | "CLOSED" | "MERGED";
  isDraft?: boolean;
  merged?: boolean;
  mergedAt?: string | null;
  closedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  url?: string;
  baseRefName?: string;
  headRefName?: string;
  comments?: { totalCount?: number };
  reviews?: { totalCount?: number };
  author?: {
    login?: string;
    avatarUrl?: string;
    url?: string;
  } | null;
  repository?: {
    nameWithOwner?: string;
    stargazerCount?: number;
    isPrivate?: boolean;
    isArchived?: boolean;
    isDisabled?: boolean;
    primaryLanguage?: { name?: string } | null;
    licenseInfo?: { spdxId?: string; name?: string; url?: string } | null;
    owner?: { login?: string; avatarUrl?: string } | null;
  } | null;
};

type SyncStateRow = {
  pull_requests_synced_at: Date | string | null;
};

type ExistingItemRow = {
  item_id: string;
};

type IgnoredItemRow = {
  item_id: string;
  repo: string;
  title: string;
  url: string | null;
  ignored_at: Date | string;
};

type PullRequestSearchPayload = {
  errors?: unknown[];
  data?: {
    search?: {
      nodes?: PullRequestNode[];
      pageInfo?: {
        hasNextPage?: boolean;
        endCursor?: string | null;
      };
    };
  };
};

const GITHUB_API_VERSION = "2022-11-28";
const MINIMUM_STARS = 0;
const SYNC_TTL_MS = 24 * 60 * 60 * 1_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 3;

const PULL_REQUEST_SEARCH_QUERY = `
  query AuthoredPullRequests($query: String!, $first: Int!, $after: String) {
    search(type: ISSUE, query: $query, first: $first, after: $after) {
      nodes {
        ... on PullRequest {
          number
          title
          bodyText
          state
          isDraft
          merged
          mergedAt
          closedAt
          createdAt
          updatedAt
          additions
          deletions
          changedFiles
          url
          baseRefName
          headRefName
          comments { totalCount }
          reviews { totalCount }
          author { login avatarUrl url }
          repository {
            nameWithOwner
            stargazerCount
            isPrivate
            isArchived
            isDisabled
            primaryLanguage { name }
            licenseInfo { spdxId name url }
            owner { login avatarUrl }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const jsonResponse = (response: any, status: number, body: unknown) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
};

const text = (value: unknown, maxLength: number, fallback = "") => (
  typeof value === "string" ? value.trim().slice(0, maxLength) || fallback : fallback
);

const integer = (value: unknown) => (
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0
);

const normalizeLanguage = (language: string) => {
  if (!language) return [];
  return [language === "HTML" || language === "CSS" ? "HTML/CSS" : language];
};

const plainTextSummary = (value: unknown, fallback: string) => {
  const summary = text(value, 12_000)
    .replace(/\s+/g, " ")
    .trim();
  if (!summary) return fallback;
  return summary.length > 220 ? `${summary.slice(0, 217).trim()}...` : summary;
};

const itemId = (pullRequest: PullRequestNode) => {
  const repository = text(pullRequest.repository?.nameWithOwner, 300);
  const number = integer(pullRequest.number);
  return repository && number ? `github-pr-${repository}-${number}` : "";
};

export const isEligibleContributionPullRequest = (
  pullRequest: PullRequestNode,
  githubLogin: string
) => {
  const repository = pullRequest.repository;
  const authorLogin = text(pullRequest.author?.login, 100).toLowerCase();
  const ownerLogin = text(repository?.owner?.login, 100).toLowerCase();
  const login = githubLogin.toLowerCase();
  const activeContribution = pullRequest.merged === true || pullRequest.state === "OPEN";

  return Boolean(
    itemId(pullRequest)
    && authorLogin === login
    && ownerLogin !== login
    && repository?.isPrivate === false
    && repository?.isArchived === false
    && repository?.isDisabled === false
    && activeContribution
  );
};

const mapPullRequestItem = (pullRequest: PullRequestNode): WorkspaceItem => {
  const now = new Date().toISOString();
  const repository = pullRequest.repository!;
  const repositoryName = text(repository.nameWithOwner, 300);
  const merged = pullRequest.merged === true;
  const draft = pullRequest.isDraft === true;
  const stateLabel = merged ? "병합됨" : draft ? "초안" : "검토 중";
  const changedFiles = integer(pullRequest.changedFiles);
  const additions = integer(pullRequest.additions);
  const deletions = integer(pullRequest.deletions);

  return {
    id: itemId(pullRequest),
    kind: "pull_request",
    status: merged ? "completed" : "in_progress",
    repo: repositoryName,
    title: text(pullRequest.title, 500, `Pull Request #${integer(pullRequest.number)}`),
    summary: plainTextSummary(
      pullRequest.bodyText,
      `변경 파일 ${changedFiles}개 · +${additions} / -${deletions}`
    ),
    difficulty: stateLabel,
    workType: "Pull Request",
    languageTags: normalizeLanguage(text(repository.primaryLanguage?.name, 50)),
    savedAt: now,
    updatedAt: now,
    url: text(pullRequest.url, 2_000),
    data: {
      source: "github-pull-request-sync",
      repositoryAvatarUrl: text(repository.owner?.avatarUrl, 2_000),
      repositoryStars: integer(repository.stargazerCount),
      repositoryLicense: text(repository.licenseInfo?.spdxId, 100),
      number: integer(pullRequest.number),
      author: {
        login: text(pullRequest.author?.login, 100),
        avatarUrl: text(pullRequest.author?.avatarUrl, 2_000),
        url: text(pullRequest.author?.url, 2_000)
      },
      state: merged ? "closed" : "open",
      draft,
      merged,
      mergedAt: pullRequest.mergedAt || null,
      closedAt: pullRequest.closedAt || null,
      createdAt: pullRequest.createdAt || now,
      updatedAt: pullRequest.updatedAt || now,
      additions,
      deletions,
      changedFiles,
      comments: integer(pullRequest.comments?.totalCount),
      reviewComments: integer(pullRequest.reviews?.totalCount),
      headBranch: text(pullRequest.headRefName, 300),
      baseBranch: text(pullRequest.baseRefName, 300)
    }
  };
};

const githubHeaders = (githubToken: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${githubToken}`,
  "Content-Type": "application/json",
  "User-Agent": "giyeoro-pull-request-sync",
  "X-GitHub-Api-Version": GITHUB_API_VERSION
});

export const fetchAuthoredPullRequests = async (user: GithubUser, githubToken: string) => {
  const nodes: PullRequestNode[] = [];
  let cursor: string | null = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const githubResponse: Response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: githubHeaders(githubToken),
      body: JSON.stringify({
        query: PULL_REQUEST_SEARCH_QUERY,
        variables: {
          query: `is:pr author:${user.login} sort:updated-desc`,
          first: PAGE_SIZE,
          after: cursor
        }
      }),
      signal: AbortSignal.timeout(25_000)
    });
    if (githubResponse.status === 403 || githubResponse.status === 429) throw new Error("GITHUB_RATE_LIMIT");
    if (!githubResponse.ok) throw new Error("GITHUB_FETCH_FAILED");

    const payload = await githubResponse.json() as PullRequestSearchPayload;
    if (payload.errors?.length) throw new Error("GITHUB_FETCH_FAILED");
    const search = payload.data?.search;
    nodes.push(...(Array.isArray(search?.nodes) ? search.nodes.filter(Boolean) : []));
    cursor = search?.pageInfo?.endCursor || null;
    if (!search?.pageInfo?.hasNextPage || !cursor) return { nodes, truncated: false };
    truncated = true;
  }

  return { nodes, truncated };
};

const resolveDatabaseUrl = (options: PullRequestSyncOptions) => (
  options.databaseUrl || process.env.DATABASE_URL || ""
).trim();

const listIgnoredItems = async (database: ReturnType<typeof getDatabase>, userId: number) => {
  const result = await database.execute<IgnoredItemRow>(sql`
    SELECT item_id, repo, title, url, ignored_at
    FROM workspace_ignored_items
    WHERE user_id = ${userId} AND kind = 'pull_request'
    ORDER BY ignored_at DESC
  `);
  return result.rows.map(row => ({
    id: row.item_id,
    repo: row.repo,
    title: row.title,
    url: row.url || "",
    ignoredAt: new Date(row.ignored_at).toISOString()
  }));
};

const syncResponse = async (
  response: any,
  database: ReturnType<typeof getDatabase>,
  userId: number,
  details: Record<string, unknown>
) => jsonResponse(response, 200, {
  items: await listWorkspaceItems(database, userId),
  ignoredItems: await listIgnoredItems(database, userId),
  minimumStars: MINIMUM_STARS,
  ...details
});

export const handleGithubPullRequestSyncRequest = async (
  request: any,
  response: any,
  options: PullRequestSyncOptions = {}
) => {
  const user = readGithubSessionUser(request, options);
  if (!user) return jsonResponse(response, 401, { error: "GitHub 로그인이 필요합니다." });

  const databaseUrl = resolveDatabaseUrl(options);
  if (!databaseUrl) return jsonResponse(response, 503, { error: "데이터베이스가 연결되지 않았습니다." });
  const database = getDatabase(databaseUrl);

  try {
    await upsertWorkspaceUser(database, user);

    if (request.method === "PATCH") {
      const body = request.body && typeof request.body === "object"
        ? request.body
        : await new Promise<Record<string, unknown>>((resolve, reject) => {
          let raw = "";
          request.setEncoding("utf8");
          request.on("data", (chunk: string) => { raw += chunk; });
          request.on("end", () => {
            try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("INVALID_JSON")); }
          });
          request.on("error", reject);
        });
      const id = text(body.id, 300);
      const repo = text(body.repo, 300);
      if (!id && !repo) return jsonResponse(response, 400, { error: "복구할 PR 또는 프로젝트가 올바르지 않습니다." });
      if (repo) {
        await database.execute(sql`
          DELETE FROM workspace_ignored_items
          WHERE user_id = ${user.id} AND LOWER(repo) = LOWER(${repo}) AND kind = 'pull_request'
        `);
      } else {
        await database.execute(sql`
          DELETE FROM workspace_ignored_items
          WHERE user_id = ${user.id} AND item_id = ${id} AND kind = 'pull_request'
        `);
      }
      return jsonResponse(response, 200, { ok: true });
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "POST, PATCH");
      return jsonResponse(response, 405, { error: "지원하지 않는 요청 방식입니다." });
    }

    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const force = requestUrl.searchParams.get("force") === "1";
    const syncState = await database.execute<SyncStateRow>(sql`
      SELECT pull_requests_synced_at
      FROM users
      WHERE github_id = ${user.id}
      LIMIT 1
    `);
    const lastSyncedAt = syncState.rows[0]?.pull_requests_synced_at || null;
    const lastSyncedAtMs = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0;

    if (!force && lastSyncedAtMs > Date.now() - SYNC_TTL_MS) {
      return syncResponse(response, database, user.id, {
        synced: false,
        syncedAt: new Date(lastSyncedAt!).toISOString(),
        importedCount: 0,
        updatedCount: 0,
        scannedCount: 0,
        truncated: false
      });
    }

    const githubToken = (options.githubToken || process.env.GITHUB_TOKEN || "").trim();
    if (!githubToken) {
      return jsonResponse(response, 503, { error: "GitHub PR 동기화 토큰이 설정되지 않았습니다." });
    }

    const [{ nodes, truncated }, ignoredResult, existingResult] = await Promise.all([
      fetchAuthoredPullRequests(user, githubToken),
      database.execute<{ item_id: string; repo: string }>(sql`
        SELECT item_id, repo FROM workspace_ignored_items
        WHERE user_id = ${user.id} AND kind = 'pull_request'
      `),
      database.execute<ExistingItemRow>(sql`
        SELECT item_id FROM workspace_items
        WHERE user_id = ${user.id} AND kind = 'pull_request'
      `)
    ]);
    const ignoredIds = new Set(ignoredResult.rows.map(row => row.item_id));
    const ignoredRepositories = new Set(ignoredResult.rows.map(row => row.repo.toLowerCase()));
    const existingIds = new Set(existingResult.rows.map(row => row.item_id));
    const eligibleItems = nodes
      .filter(node => isEligibleContributionPullRequest(node, user.login))
      .map(mapPullRequestItem)
      .filter(item => !ignoredIds.has(item.id) && !ignoredRepositories.has(item.repo.toLowerCase()));
    const importedCount = eligibleItems.filter(item => !existingIds.has(item.id)).length;

    for (let index = 0; index < eligibleItems.length; index += 10) {
      await Promise.all(
        eligibleItems.slice(index, index + 10)
          .map(item => upsertWorkspaceItem(database, user.id, item))
      );
    }

    const syncedAt = new Date().toISOString();
    await database.execute(sql`
      UPDATE users
      SET pull_requests_synced_at = ${syncedAt}, updated_at = NOW()
      WHERE github_id = ${user.id}
    `);

    return syncResponse(response, database, user.id, {
      synced: true,
      syncedAt,
      importedCount,
      updatedCount: eligibleItems.length - importedCount,
      scannedCount: nodes.length,
      truncated
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INVALID_JSON") {
      return jsonResponse(response, 400, { error: "요청 데이터가 올바르지 않습니다." });
    }
    if (message === "GITHUB_RATE_LIMIT") {
      return jsonResponse(response, 429, { error: "GitHub API 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요." });
    }
    if (error instanceof Error && (error.name === "TimeoutError" || /timeout/i.test(message))) {
      return jsonResponse(response, 504, { error: "GitHub PR 동기화 시간이 초과됐습니다." });
    }
    console.error("GitHub pull request sync failed", error);
    return jsonResponse(response, 502, { error: "GitHub에서 기여한 PR을 동기화하지 못했습니다." });
  }
};
