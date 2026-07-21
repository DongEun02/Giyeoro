import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { enforceVerifiedPostgresTls } from "../server/postgresUrl.js";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED?.trim()
  || process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL이 설정되지 않았습니다.");
}

const migrationUrl = new URL("../database/migrations/001_workspace.sql", import.meta.url);
const migration = await readFile(fileURLToPath(migrationUrl), "utf8");
const pool = new Pool({
  connectionString: enforceVerifiedPostgresTls(databaseUrl),
  max: 1
});

const statements = migration
  .split(/;\s*(?:\n|$)/)
  .map(statement => statement.trim())
  .filter(Boolean);

try {
  for (const statement of statements) {
    await pool.query(statement);
  }
} finally {
  await pool.end();
}
console.log("Workspace database migration completed.");
