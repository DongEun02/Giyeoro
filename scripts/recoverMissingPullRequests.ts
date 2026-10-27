import { parseArgs } from "node:util";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { enforceVerifiedPostgresTls } from "../server/postgresUrl.js";
import {
  fetchAuthoredPullRequestHistoryPage,
  selectMissingPullRequestsToRecover
} from "../server/githubPullRequestSyncService.js";
import { isValidPortfolioLogin } from "../server/publicPortfolioService.js";
import { upsertWorkspaceItem } from "../server/workspaceService.js";
import type { GithubUser } from "../server/githubAuthService.js";
import type { Database } from "../server/database.js";

const { values } = parseArgs({ options: { login: { type: "string" }, apply: { type: "boolean", default: false } } });
if (!values.login || !isValidPortfolioLogin(values.login)) throw new Error("--login GitHub아이디가 필요합니다.");
const connectionString = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();
const githubToken = process.env.GITHUB_TOKEN?.trim();
if (!connectionString || !githubToken) throw new Error("DATABASE_URL과 GITHUB_TOKEN이 필요합니다.");
const pool = new Pool({ connectionString: enforceVerifiedPostgresTls(connectionString), max: 1, connectionTimeoutMillis: 10_000 });
const database = drizzle({ client: pool });

const readCurrentItems = async (db: Database, userId: number) => {
  const existing = await db.execute<{ item_id: string }>(sql`
    SELECT item_id FROM workspace_items WHERE user_id = ${userId}
  `);
  const ignored = await db.execute<{ item_id: string; repo: string }>(sql`
    SELECT item_id, repo FROM workspace_ignored_items WHERE user_id = ${userId} AND kind = 'pull_request'
  `);
  return { existingIds: new Set(existing.rows.map(row => row.item_id)), ignored: ignored.rows };
};

try {
  const users = await database.execute<{ github_id: string; github_login: string; name: string; avatar_url: string; profile_url: string }>(sql`
    SELECT github_id, github_login, name, avatar_url, profile_url
    FROM users WHERE LOWER(github_login) = LOWER(${values.login})
  `);
  if (users.rows.length !== 1) throw new Error("해당 계정이 DB에 없거나 중복되어 있습니다.");
  const row = users.rows[0];
  const user: GithubUser = { id: Number(row.github_id), login: row.github_login, name: row.name, avatarUrl: row.avatar_url, profileUrl: row.profile_url };
  const before = await readCurrentItems(database, user.id);
  console.log(JSON.stringify({ login: user.login, mode: values.apply ? "apply" : "dry-run", existing: before.existingIds.size, hidden: before.ignored.length }));

  const nodes: Awaited<ReturnType<typeof fetchAuthoredPullRequestHistoryPage>>["nodes"] = [];
  let cursor: string | null = null;
  do {
    const page = await fetchAuthoredPullRequestHistoryPage(user, githubToken, cursor);
    nodes.push(...page.nodes);
    console.log(JSON.stringify({ scanned: nodes.length, hasMore: page.hasMore }));
    cursor = page.hasMore ? page.nextCursor : null;
  } while (cursor);
  const candidates = selectMissingPullRequestsToRecover(nodes, user.login, before.existingIds, before.ignored);
  console.log(JSON.stringify({ candidates: candidates.map(item => ({ id: item.id, repo: item.repo, state: item.data.merged ? "merged" : item.data.state })) }));
  if (values.apply) {
    const restored = await database.transaction(async transaction => {
      // Recheck current data after GitHub pagination; never overwrite existing PRs or remove hidden records.
      await transaction.execute(sql`SELECT github_id FROM users WHERE github_id = ${user.id} FOR UPDATE`);
      const current = await readCurrentItems(transaction, user.id);
      const items = selectMissingPullRequestsToRecover(nodes, user.login, current.existingIds, current.ignored);
      for (const item of items) await upsertWorkspaceItem(transaction, user.id, item);
      return items;
    });
    const after = await readCurrentItems(database, user.id);
    if (restored.some(item => !after.existingIds.has(item.id))) throw new Error("복구 결과 확인에 실패했습니다.");
    console.log(JSON.stringify({ restored: restored.length, total: after.existingIds.size, hidden: after.ignored.length, verified: true }));
  }
} finally {
  await pool.end();
}
