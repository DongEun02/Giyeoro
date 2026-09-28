import { sql } from "drizzle-orm";
import { getDatabase } from "./database.js";

type PublicPortfolioOptions = {
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

export type PortfolioVisibilityCandidate = Pick<PortfolioItemRow, "kind" | "status" | "data">;

const jsonResponse = (response: any, status: number, body: unknown) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
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

export const isPublicPortfolioItem = ({ kind, status, data }: PortfolioVisibilityCandidate) => {
  if (status !== "completed") return false;
  if (kind !== "pull_request") return false;
  const itemData = object(data);
  return itemData.merged === true && nonNegativeInteger(itemData.repositoryStars) >= 50;
};

const mapPortfolioItem = (row: PortfolioItemRow) => {
  const data = object(row.data);
  const updatedAt = isoDate(row.updated_at, new Date().toISOString());
  const kind = row.kind as "issue" | "pull_request";
  const mergedAt = kind === "pull_request" ? isoDate(data.mergedAt, "") : "";
  const author = object(data.author);

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
    completedAt: mergedAt || updatedAt,
    repositoryAvatarUrl: safeHttpsUrl(data.repositoryAvatarUrl),
    number: nonNegativeInteger(data.number),
    ...(kind === "pull_request" ? {
      additions: nonNegativeInteger(data.additions),
      deletions: nonNegativeInteger(data.deletions),
      changedFiles: nonNegativeInteger(data.changedFiles),
      mergedAt: mergedAt || updatedAt,
      authorLogin: text(author.login, 100)
    } : {})
  };
};

const resolveDatabaseUrl = (options: PublicPortfolioOptions) => (
  options.databaseUrl || process.env.DATABASE_URL || ""
).trim();

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

    const itemResult = await database.execute<PortfolioItemRow>(sql`
      SELECT item_id, kind, status, repo, title, summary, difficulty, work_type,
        language_tags, url, data, updated_at
      FROM workspace_items
      WHERE user_id = ${user.github_id}
        AND kind = 'pull_request'
        AND status = 'completed'
        AND COALESCE(data ->> 'merged', 'false') = 'true'
      ORDER BY updated_at DESC
    `);

    const items = itemResult.rows
      .filter(isPublicPortfolioItem)
      .map(mapPortfolioItem);

    return jsonResponse(response, 200, {
      profile: {
        login: text(user.github_login, 39),
        name: text(user.name, 200, user.github_login),
        avatarUrl: safeHttpsUrl(user.avatar_url),
        profileUrl: safeHttpsUrl(user.profile_url, "github.com")
      },
      items
    });
  } catch (error) {
    console.error("Public portfolio API failed", error);
    return jsonResponse(response, 500, { error: "공개 포트폴리오를 불러오지 못했습니다." });
  }
};
