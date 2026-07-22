import { readdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { enforceVerifiedPostgresTls } from "../server/postgresUrl.js";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED?.trim()
  || process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL이 설정되지 않았습니다.");
}

const migrationsUrl = new URL("../database/migrations/", import.meta.url);
const migrationsDirectory = fileURLToPath(migrationsUrl);
const pool = new Pool({
  connectionString: enforceVerifiedPostgresTls(databaseUrl),
  max: 1
});

try {
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter(file => file.endsWith(".sql"))
    .sort();
  for (const migrationFile of migrationFiles) {
    const migrationUrl = new URL(migrationFile, migrationsUrl);
    const migration = await readFile(fileURLToPath(migrationUrl), "utf8");
    const statements = migration
      .split(/;\s*(?:\n|$)/)
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await pool.query(statement);
    }
    console.log(`Applied ${migrationFile}`);
  }
} finally {
  await pool.end();
}
console.log(`Database migrations completed from ${dirname(migrationsDirectory)}.`);
