import { sql } from "drizzle-orm";
import { getDatabase } from "./database.js";
import type { Database } from "./database.js";
import { readGithubSessionUser } from "./githubAuthService.js";
import type { GithubAuthOptions, GithubUser } from "./githubAuthService.js";

type WorkspaceServiceOptions = GithubAuthOptions & {
  databaseUrl?: string;
};

type WorkspaceStatus = "interested" | "in_progress" | "completed";
type WorkspaceKind = "issue" | "translation";

type WorkspaceItem = {
  id: string;
  kind: WorkspaceKind;
  status: WorkspaceStatus;
  repo: string;
  title: string;
  summary: string;
  difficulty: string;
  workType: string;
  languageTags: string[];
  savedAt: string;
  updatedAt: string;
  url?: string;
  data: Record<string, unknown>;
};

type WorkspaceRow = {
  item_id: string;
  kind: WorkspaceKind;
  status: WorkspaceStatus;
  repo: string;
  title: string;
  summary: string;
  difficulty: string;
  work_type: string;
  language_tags: unknown;
  saved_at: Date | string;
  updated_at: Date | string;
  url: string | null;
  data: unknown;
};

const WORKSPACE_STATUSES = new Set<WorkspaceStatus>(["interested", "in_progress", "completed"]);
const WORKSPACE_KINDS = new Set<WorkspaceKind>(["issue", "translation"]);
const MAX_ITEMS_PER_SYNC = 100;
const MAX_REQUEST_BYTES = 512 * 1024;

const jsonResponse = (response: any, status: number, body: unknown) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
};

const readJsonBody = (request: any): Promise<unknown> => {
  if (request.body && typeof request.body === "object") return Promise.resolve(request.body);

  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      raw += chunk;
      if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) {
        reject(new Error("REQUEST_TOO_LARGE"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
    request.on("error", reject);
  });
};

const text = (value: unknown, maxLength: number, fallback = "") => {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
};

const timestamp = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
};

const jsonObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > 64 * 1024) throw new Error("ITEM_DATA_TOO_LARGE");
  return value as Record<string, unknown>;
};

const parseWorkspaceItem = (value: unknown): WorkspaceItem | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const id = text(candidate.id, 300);
  const repo = text(candidate.repo, 300);
  const title = text(candidate.title, 500);
  const kind = candidate.kind;
  const status = candidate.status;

  if (
    !id
    || !repo
    || !title
    || typeof kind !== "string"
    || !WORKSPACE_KINDS.has(kind as WorkspaceKind)
    || typeof status !== "string"
    || !WORKSPACE_STATUSES.has(status as WorkspaceStatus)
  ) return null;

  const now = new Date().toISOString();
  const languageTags = Array.isArray(candidate.languageTags)
    ? candidate.languageTags.map(tag => text(tag, 50)).filter(Boolean).slice(0, 20)
    : [];
  const url = text(candidate.url, 2000);

  return {
    id,
    kind: kind as WorkspaceKind,
    status: status as WorkspaceStatus,
    repo,
    title,
    summary: text(candidate.summary, 5000),
    difficulty: text(candidate.difficulty, 100),
    workType: text(candidate.workType, 100),
    languageTags,
    savedAt: timestamp(candidate.savedAt, now),
    updatedAt: timestamp(candidate.updatedAt, now),
    ...(url ? { url } : {}),
    data: jsonObject(candidate.data)
  };
};

const resolveDatabaseUrl = (options: WorkspaceServiceOptions) => (
  options.databaseUrl || process.env.DATABASE_URL || ""
).trim();

const mapRow = (row: WorkspaceRow): WorkspaceItem => ({
  id: row.item_id,
  kind: row.kind,
  status: row.status,
  repo: row.repo,
  title: row.title,
  summary: row.summary,
  difficulty: row.difficulty,
  workType: row.work_type,
  languageTags: Array.isArray(row.language_tags) ? row.language_tags.filter(tag => typeof tag === "string") : [],
  savedAt: new Date(row.saved_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
  ...(row.url ? { url: row.url } : {}),
  data: row.data && typeof row.data === "object" && !Array.isArray(row.data)
    ? row.data as Record<string, unknown>
    : {}
});

const upsertUser = async (database: Database, user: GithubUser) => {
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
};

const upsertItem = async (database: Database, userId: number, item: WorkspaceItem) => {
  await database.execute(sql`
    INSERT INTO workspace_items (
      user_id, item_id, kind, status, repo, title, summary, difficulty,
      work_type, language_tags, url, data, saved_at, updated_at
    ) VALUES (
      ${userId}, ${item.id}, ${item.kind}, ${item.status}, ${item.repo}, ${item.title},
      ${item.summary}, ${item.difficulty}, ${item.workType},
      ${JSON.stringify(item.languageTags)}::jsonb, ${item.url || null},
      ${JSON.stringify(item.data)}::jsonb, ${item.savedAt}, ${item.updatedAt}
    )
    ON CONFLICT (user_id, item_id) DO UPDATE SET
      kind = EXCLUDED.kind,
      status = EXCLUDED.status,
      repo = EXCLUDED.repo,
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      difficulty = EXCLUDED.difficulty,
      work_type = EXCLUDED.work_type,
      language_tags = EXCLUDED.language_tags,
      url = EXCLUDED.url,
      data = EXCLUDED.data,
      updated_at = GREATEST(workspace_items.updated_at, EXCLUDED.updated_at)
    WHERE EXCLUDED.updated_at >= workspace_items.updated_at
  `);
};

const listItems = async (database: Database, userId: number) => {
  const result = await database.execute<WorkspaceRow>(sql`
    SELECT item_id, kind, status, repo, title, summary, difficulty, work_type,
      language_tags, saved_at, updated_at, url, data
    FROM workspace_items
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `);
  return result.rows.map(mapRow);
};

export const handleWorkspaceRequest = async (
  request: any,
  response: any,
  options: WorkspaceServiceOptions = {}
) => {
  const user = readGithubSessionUser(request, options);
  if (!user) return jsonResponse(response, 401, { error: "GitHub 로그인이 필요합니다." });

  const databaseUrl = resolveDatabaseUrl(options);
  if (!databaseUrl) return jsonResponse(response, 503, { error: "데이터베이스가 연결되지 않았습니다." });

  const database = getDatabase(databaseUrl);

  try {
    await upsertUser(database, user);

    if (request.method === "GET") {
      return jsonResponse(response, 200, { items: await listItems(database, user.id) });
    }

    if (request.method === "POST") {
      const body = await readJsonBody(request) as { items?: unknown };
      if (!Array.isArray(body.items) || body.items.length > MAX_ITEMS_PER_SYNC) {
        return jsonResponse(response, 400, { error: "동기화할 작업 목록이 올바르지 않습니다." });
      }
      const items = body.items.map(parseWorkspaceItem);
      if (items.some(item => !item)) {
        return jsonResponse(response, 400, { error: "저장할 작업 데이터가 올바르지 않습니다." });
      }
      await Promise.all((items as WorkspaceItem[]).map(item => upsertItem(database, user.id, item)));
      return jsonResponse(response, 200, { items: await listItems(database, user.id) });
    }

    if (request.method === "PUT") {
      const body = await readJsonBody(request) as { item?: unknown };
      const item = parseWorkspaceItem(body.item);
      if (!item) return jsonResponse(response, 400, { error: "저장할 작업 데이터가 올바르지 않습니다." });
      await upsertItem(database, user.id, item);
      return jsonResponse(response, 200, { item });
    }

    if (request.method === "PATCH") {
      const body = await readJsonBody(request) as { id?: unknown; status?: unknown };
      const id = text(body.id, 300);
      const status = body.status;
      if (!id || typeof status !== "string" || !WORKSPACE_STATUSES.has(status as WorkspaceStatus)) {
        return jsonResponse(response, 400, { error: "변경할 작업 상태가 올바르지 않습니다." });
      }
      const result = await database.execute(sql`
        UPDATE workspace_items
        SET status = ${status}, updated_at = NOW()
        WHERE user_id = ${user.id} AND item_id = ${id}
        RETURNING item_id
      `);
      if (result.rows.length === 0) return jsonResponse(response, 404, { error: "저장된 작업을 찾지 못했습니다." });
      return jsonResponse(response, 200, { ok: true, updatedAt: new Date().toISOString() });
    }

    if (request.method === "DELETE") {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      const id = text(requestUrl.searchParams.get("id"), 300);
      if (!id) return jsonResponse(response, 400, { error: "삭제할 작업 ID가 필요합니다." });
      await database.execute(sql`DELETE FROM workspace_items WHERE user_id = ${user.id} AND item_id = ${id}`);
      return jsonResponse(response, 200, { ok: true });
    }

    response.setHeader("Allow", "GET, POST, PUT, PATCH, DELETE");
    return jsonResponse(response, 405, { error: "지원하지 않는 요청 방식입니다." });
  } catch (error) {
    if (error instanceof Error && ["REQUEST_TOO_LARGE", "INVALID_JSON", "ITEM_DATA_TOO_LARGE"].includes(error.message)) {
      return jsonResponse(response, 400, { error: "요청 데이터가 올바르지 않거나 너무 큽니다." });
    }
    console.error("Workspace API failed", error);
    return jsonResponse(response, 500, { error: "작업 목록을 처리하지 못했습니다." });
  }
};
