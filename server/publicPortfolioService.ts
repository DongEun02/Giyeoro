import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDatabase } from "./database.js";
import type { Database } from "./database.js";
import { readGithubSessionUser } from "./githubAuthService.js";
import type { GithubAuthOptions, GithubUser } from "./githubAuthService.js";
import { isPortfolioStatusFilter } from "../shared/publicPortfolio.js";
import type { PortfolioStatusFilter } from "../shared/publicPortfolio.js";

type PublicPortfolioOptions = GithubAuthOptions & {
  databaseUrl?: string;
};

type PortfolioUserRow = {
  github_id: number | string;
  github_login: string;
  name: string;
  avatar_url: string;
  profile_url: string;
};

type PortfolioItemRow = {
  item_id: string;
  kind: "issue" | "translation" | "pull_request";
  status: "interested" | "in_progress" | "completed";
  repo: string;
  title: string;
  summary: string;
  difficulty: string;
  work_type: string;
  language_tags: unknown;
  url: string | null;
  data: unknown;
  updated_at: Date | string;
};

type PortfolioSnapshotRow = {
  snapshot: unknown;
};

type PublicPortfolio = {
  profile: {
    login: string;
    name: string;
    avatarUrl: string;
    profileUrl: string;
  };
  items: ReturnType<typeof mapPortfolioItem>[];
};

export type PortfolioVisibilityCandidate = Pick<PortfolioItemRow, "kind" | "status" | "data">;

const jsonResponse = (
  response: any,
  status: number,
  body: unknown,
  cacheControl = "public, max-age=0, s-maxage=60, stale-while-revalidate=300"
) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cacheControl);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
};

const text = (value: unknown, maxLength: number, fallback = "") => (
  typeof value === "string" ? value.trim().slice(0, maxLength) || fallback : fallback
);

const object = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const nonNegativeInteger = (value: unknown) => (
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0
);

const isoDate = (value: unknown, fallback: string) => {
  if (typeof value !== "string" && !(value instanceof Date)) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
};

const safeHttpsUrl = (value: unknown, allowedHost?: string) => {
  const candidate = text(value, 2_000);
  if (!candidate) return "";

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") return "";
    if (allowedHost && parsed.hostname !== allowedHost && !parsed.hostname.endsWith(`.${allowedHost}`)) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
};

export const isValidPortfolioLogin = (value: string) => /^[A-Za-z0-9-]{1,39}$/.test(value);
export const isValidPortfolioSnapshotId = (value: string) => /^[A-Za-z0-9_-]{24}$/.test(value);

export const isPublicPortfolioItem = ({ kind, status, data }: PortfolioVisibilityCandidate, filter: PortfolioStatusFilter | readonly PortfolioStatusFilter[] = "merged") => {
  if (status !== "completed" && status !== "in_progress") return false;
  if (kind !== "pull_request") return false;
  const itemData = object(data);
  if (itemData.merged === true && status !== "completed") return false;
  const state = itemData.merged === true ? "merged" : itemData.state;
  const filters = typeof filter === "string" ? [filter] : filter;
  if (!filters.some(value => value === "all" || value === state)) return false;
  return (itemData.merged === true || itemData.state === "open" || itemData.state === "closed")
    && nonNegativeInteger(itemData.repositoryStars) >= 50;
};

const mapPortfolioItem = (row: PortfolioItemRow) => {
  const data = object(row.data);
  const updatedAt = isoDate(row.updated_at, new Date().toISOString());
  const kind = row.kind as "issue" | "pull_request";
  const mergedAt = kind === "pull_request" ? isoDate(data.mergedAt, "") : "";
  const author = object(data.author);
  const state = data.merged === true ? "merged" : data.state === "closed" ? "closed" : "open";
  const closedAt = isoDate(data.closedAt, "");

  return {
    id: text(row.item_id, 300),
    kind,
    repo: text(row.repo, 300),
    title: text(row.title, 500),
    summary: text(row.summary, 1_200),
    difficulty: text(row.difficulty, 100),
    workType: text(row.work_type, 100),
    languageTags: Array.isArray(row.language_tags)
      ? row.language_tags.map(tag => text(tag, 50)).filter(Boolean).slice(0, 8)
      : [],
    url: safeHttpsUrl(row.url, "github.com"),
    completedAt: mergedAt || closedAt || updatedAt,
    repositoryAvatarUrl: safeHttpsUrl(data.repositoryAvatarUrl),
    number: nonNegativeInteger(data.number),
    ...(kind === "pull_request" ? {
      additions: nonNegativeInteger(data.additions),
      deletions: nonNegativeInteger(data.deletions),
      changedFiles: nonNegativeInteger(data.changedFiles),
      state,
      mergedAt: state === "merged" ? mergedAt || updatedAt : undefined,
      authorLogin: text(author.login, 100)
    } : {})
  };
};

const resolveDatabaseUrl = (options: PublicPortfolioOptions) => (
  options.databaseUrl || process.env.DATABASE_URL || ""
).trim();

const listPublicPortfolioItems = async (database: Database, userId: number | string, filter: readonly PortfolioStatusFilter[] = ["merged"]) => {
  const itemResult = await database.execute<PortfolioItemRow>(sql`
    SELECT item_id, kind, status, repo, title, summary, difficulty, work_type,
      language_tags, url, data, updated_at
    FROM workspace_items
    WHERE user_id = ${userId}
      AND kind = 'pull_request'
      AND status IN ('completed', 'in_progress')
    ORDER BY updated_at DESC
  `);

  return itemResult.rows
    .filter(item => isPublicPortfolioItem(item, filter))
    .map(mapPortfolioItem);
};

const portfolioFromUser = async (
  database: Database,
  user: Pick<PortfolioUserRow, "github_id" | "github_login" | "name" | "avatar_url" | "profile_url">
): Promise<PublicPortfolio> => ({
  profile: {
    login: text(user.github_login, 39),
    name: text(user.name, 200, user.github_login),
    avatarUrl: safeHttpsUrl(user.avatar_url),
    profileUrl: safeHttpsUrl(user.profile_url, "github.com")
  },
  items: await listPublicPortfolioItems(database, user.github_id)
});

const portfolioFromSessionUser = async (database: Database, user: GithubUser, filter: readonly PortfolioStatusFilter[]): Promise<PublicPortfolio> => ({
  profile: {
    login: text(user.login, 39),
    name: text(user.name, 200, user.login),
    avatarUrl: safeHttpsUrl(user.avatarUrl),
    profileUrl: safeHttpsUrl(user.profileUrl, "github.com")
  },
  items: await listPublicPortfolioItems(database, user.id, filter)
});

export const handlePublicPortfolioRequest = async (
  request: any,
  response: any,
  options: PublicPortfolioOptions = {}
) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return jsonResponse(response, 405, { error: "공개 포트폴리오는 조회만 할 수 있습니다." });
  }

  const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
  const login = text(requestUrl.searchParams.get("login"), 39);
  if (!isValidPortfolioLogin(login)) {
    return jsonResponse(response, 400, { error: "GitHub 사용자 이름이 올바르지 않습니다." });
  }

  const databaseUrl = resolveDatabaseUrl(options);
  if (!databaseUrl) {
    return jsonResponse(response, 503, { error: "데이터베이스가 연결되지 않았습니다." });
  }

  try {
    const database = getDatabase(databaseUrl);
    const userResult = await database.execute<PortfolioUserRow>(sql`
      SELECT github_id, github_login, name, avatar_url, profile_url
      FROM users
      WHERE LOWER(github_login) = LOWER(${login})
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const user = userResult.rows[0];
    if (!user) {
      return jsonResponse(response, 404, { error: "공개 포트폴리오를 찾지 못했습니다." });
    }

    return jsonResponse(response, 200, await portfolioFromUser(database, user));
  } catch (error) {
    console.error("Public portfolio API failed", error);
    return jsonResponse(response, 500, { error: "공개 포트폴리오를 불러오지 못했습니다." });
  }
};

export const handlePublicPortfolioSnapshotRequest = async (
  request: any,
  response: any,
  options: PublicPortfolioOptions = {}
) => {
  const databaseUrl = resolveDatabaseUrl(options);
  if (!databaseUrl) {
    return jsonResponse(response, 503, { error: "데이터베이스가 연결되지 않았습니다." }, "no-store");
  }

  if (request.method === "POST") {
    const user = readGithubSessionUser(request, options);
    if (!user) {
      return jsonResponse(response, 401, { error: "GitHub 로그인이 필요합니다." }, "no-store");
    }

    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const requestedStatuses = requestUrl.searchParams.getAll("status");
    const filter = requestedStatuses.length ? requestedStatuses : ["merged"];
    if (!filter.every(isPortfolioStatusFilter)) {
      return jsonResponse(response, 400, { error: "공유할 PR 상태가 올바르지 않습니다." }, "no-store");
    }

    try {
      const database = getDatabase(databaseUrl);
      const snapshotId = randomBytes(18).toString("base64url");
      await database.execute(sql`
        INSERT INTO users (github_id, github_login, name, avatar_url, profile_url)
        VALUES (${user.id}, ${user.login}, ${user.name}, ${user.avatarUrl}, ${user.profileUrl})
        ON CONFLICT (github_id) DO UPDATE SET
          github_login = EXCLUDED.github_login,
          name = EXCLUDED.name,
          avatar_url = EXCLUDED.avatar_url,
          profile_url = EXCLUDED.profile_url,
          updated_at = NOW()
      `);
      const snapshot = await portfolioFromSessionUser(database, user, filter);
      await database.execute(sql`
        INSERT INTO public_portfolio_snapshots (snapshot_id, owner_id, snapshot)
        VALUES (${snapshotId}, ${user.id}, ${JSON.stringify(snapshot)}::jsonb)
      `);
      return jsonResponse(response, 201, { snapshotId }, "no-store");
    } catch (error) {
      console.error("Public portfolio snapshot creation failed", error);
      return jsonResponse(response, 500, { error: "공유용 포트폴리오를 만들지 못했습니다." }, "no-store");
    }
  }

  if (request.method === "GET") {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const snapshotId = text(requestUrl.searchParams.get("id"), 24);
    if (!isValidPortfolioSnapshotId(snapshotId)) {
      return jsonResponse(response, 400, { error: "공유 링크가 올바르지 않습니다." }, "no-store");
    }

    try {
      const database = getDatabase(databaseUrl);
      const result = await database.execute<PortfolioSnapshotRow>(sql`
        SELECT snapshot
        FROM public_portfolio_snapshots
        WHERE snapshot_id = ${snapshotId}
        LIMIT 1
      `);
      const snapshot = result.rows[0]?.snapshot as Partial<PublicPortfolio> | undefined;
      if (!snapshot?.profile?.login || !Array.isArray(snapshot.items)) {
        return jsonResponse(response, 404, { error: "공유된 포트폴리오를 찾지 못했습니다." }, "no-store");
      }
      return jsonResponse(response, 200, snapshot, "public, max-age=31536000, immutable");
    } catch (error) {
      console.error("Public portfolio snapshot fetch failed", error);
      return jsonResponse(response, 500, { error: "공유된 포트폴리오를 열지 못했습니다." }, "no-store");
    }
  }

  response.setHeader("Allow", "GET, POST");
  return jsonResponse(response, 405, { error: "지원하지 않는 요청 방식입니다." }, "no-store");
};
