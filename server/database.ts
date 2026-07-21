import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { enforceVerifiedPostgresTls } from "./postgresUrl.js";

export type Database = NodePgDatabase<Record<string, never>>;

let database: Database | null = null;
let configuredUrl = "";

export const getDatabase = (databaseUrl: string): Database => {
  if (database && configuredUrl === databaseUrl) return database;

  const pool = new Pool({
    connectionString: enforceVerifiedPostgresTls(databaseUrl),
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000
  });
  attachDatabasePool(pool);
  configuredUrl = databaseUrl;
  database = drizzle({ client: pool });
  return database;
};
