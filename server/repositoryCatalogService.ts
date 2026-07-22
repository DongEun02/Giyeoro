import { sql } from "drizzle-orm";
import { getDatabase } from "./database.js";
import type { ContributionLanguage } from "../shared/contributionCategories.js";

const LANGUAGE_ALIASES: Record<ContributionLanguage, readonly string[]> = {
  JavaScript: ["javascript"],
  TypeScript: ["typescript"],
  "HTML/CSS": ["html", "css", "scss"],
  Python: ["python"],
  Java: ["java"],
  Kotlin: ["kotlin"],
  Swift: ["swift"],
  Go: ["go"],
  Rust: ["rust"]
};

type CatalogRow = {
  full_name: string;
  deepwiki_url: string;
};

export type CatalogRepository = {
  fullName: string;
  deepWikiUrl: string;
};

export const fetchCatalogRepositories = async ({
  databaseUrl,
  language,
  limit = 10
}: {
  databaseUrl?: string;
  language: ContributionLanguage;
  limit?: number;
}): Promise<CatalogRepository[]> => {
  const resolvedDatabaseUrl = (databaseUrl || process.env.DATABASE_URL || "").trim();
  if (!resolvedDatabaseUrl) return [];

  const aliases = LANGUAGE_ALIASES[language];
  const languageCondition = sql.join(
    aliases.map(alias => sql`LOWER(primary_language) = ${alias}`),
    sql` OR `
  );

  try {
    const database = getDatabase(resolvedDatabaseUrl);
    const result = await database.execute<CatalogRow>(sql`
      SELECT full_name, deepwiki_url
      FROM repository_catalog
      WHERE is_enabled = TRUE
        AND has_issues = TRUE
        AND is_archived = FALSE
        AND license_spdx IS NOT NULL
        AND license_spdx NOT IN ('NOASSERTION', 'OTHER')
        AND (${languageCondition})
      ORDER BY
        CASE WHEN pushed_at >= NOW() - INTERVAL '90 days' THEN 0 ELSE 1 END,
        source_rank ASC NULLS LAST,
        stars DESC
      LIMIT ${Math.max(1, Math.min(limit, 20))}
    `);
    return result.rows.map(row => ({
      fullName: row.full_name,
      deepWikiUrl: row.deepwiki_url
    }));
  } catch (error) {
    console.warn("Repository catalog lookup failed; using curated fallback.", error);
    return [];
  }
};
