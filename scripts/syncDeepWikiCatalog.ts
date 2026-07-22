import { Pool } from "pg";
import { enforceVerifiedPostgresTls } from "../server/postgresUrl.js";

const DEEPWIKI_URL = "https://deepwiki.com/";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const GRAPHQL_BATCH_SIZE = 30;

const databaseUrl = process.env.DATABASE_URL_UNPOOLED?.trim()
  || process.env.DATABASE_URL?.trim();
const githubToken = process.env.GITHUB_TOKEN?.trim();

if (!databaseUrl) throw new Error("DATABASE_URL이 설정되지 않았습니다.");
if (!githubToken) throw new Error("GITHUB_TOKEN이 설정되지 않았습니다.");

const deepWikiResponse = await fetch(DEEPWIKI_URL, {
  headers: { "User-Agent": "giyeoro-catalog-sync" },
  signal: AbortSignal.timeout(30_000)
});
if (!deepWikiResponse.ok) {
  throw new Error(`DeepWiki 목록을 불러오지 못했습니다. (${deepWikiResponse.status})`);
}

const homepage = await deepWikiResponse.text();
const repositoryNames = [...homepage.matchAll(/href="\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)"/g)]
  .map(match => match[1])
  .filter((name, index, names) => names.indexOf(name) === index);
if (repositoryNames.length < 50) {
  throw new Error(`DeepWiki 저장소 링크를 충분히 찾지 못했습니다. (${repositoryNames.length}개)`);
}

const escapeGraphql = (value: string) => JSON.stringify(value);
const repositorySelection = `
  nameWithOwner
  description
  url
  primaryLanguage { name }
  repositoryTopics(first: 20) { nodes { topic { name } } }
  stargazerCount
  licenseInfo { spdxId }
  hasIssuesEnabled
  isArchived
  pushedAt
`;

type CatalogRepository = {
  nameWithOwner: string;
  description: string | null;
  url: string;
  primaryLanguage: { name: string } | null;
  repositoryTopics: { nodes: Array<{ topic: { name: string } }> };
  stargazerCount: number;
  licenseInfo: { spdxId: string } | null;
  hasIssuesEnabled: boolean;
  isArchived: boolean;
  pushedAt: string | null;
};

const repositories: CatalogRepository[] = [];
for (let offset = 0; offset < repositoryNames.length; offset += GRAPHQL_BATCH_SIZE) {
  const batch = repositoryNames.slice(offset, offset + GRAPHQL_BATCH_SIZE);
  const fields = batch.map((fullName, index) => {
    const [owner, name] = fullName.split("/");
    return `r${index}: repository(owner: ${escapeGraphql(owner)}, name: ${escapeGraphql(name)}) { ${repositorySelection} }`;
  }).join("\n");
  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "Content-Type": "application/json",
      "User-Agent": "giyeoro-catalog-sync"
    },
    body: JSON.stringify({ query: `query DeepWikiCatalog { ${fields} }` }),
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`GitHub 메타데이터 조회에 실패했습니다. (${response.status})`);
  const payload = await response.json() as {
    data?: Record<string, CatalogRepository | null>;
    errors?: Array<{ message?: string }>;
  };
  Object.values(payload.data || {}).forEach(repository => {
    if (repository?.nameWithOwner) repositories.push(repository);
  });
}

const rankByName = new Map(repositoryNames.map((name, index) => [name.toLowerCase(), index + 1]));
const pool = new Pool({
  connectionString: enforceVerifiedPostgresTls(databaseUrl),
  max: 1
});

try {
  await pool.query("BEGIN");
  for (const repository of repositories) {
    const topics = repository.repositoryTopics.nodes.map(node => node.topic.name);
    await pool.query({
      text: `
        INSERT INTO repository_catalog (
          full_name, source, source_rank, deepwiki_url, github_url, description,
          primary_language, topics, stars, license_spdx, has_issues, is_archived,
          pushed_at, source_seen_at, metadata_synced_at, updated_at
        ) VALUES (
          $1, 'deepwiki', $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11,
          $12, NOW(), NOW(), NOW()
        )
        ON CONFLICT (full_name) DO UPDATE SET
          source = EXCLUDED.source,
          source_rank = EXCLUDED.source_rank,
          deepwiki_url = EXCLUDED.deepwiki_url,
          github_url = EXCLUDED.github_url,
          description = EXCLUDED.description,
          primary_language = EXCLUDED.primary_language,
          topics = EXCLUDED.topics,
          stars = EXCLUDED.stars,
          license_spdx = EXCLUDED.license_spdx,
          has_issues = EXCLUDED.has_issues,
          is_archived = EXCLUDED.is_archived,
          pushed_at = EXCLUDED.pushed_at,
          is_enabled = TRUE,
          source_seen_at = NOW(),
          metadata_synced_at = NOW(),
          updated_at = NOW()
      `,
      values: [
        repository.nameWithOwner,
        rankByName.get(repository.nameWithOwner.toLowerCase()) || null,
        `${DEEPWIKI_URL}${repository.nameWithOwner}`,
        repository.url,
        repository.description || "",
        repository.primaryLanguage?.name || null,
        JSON.stringify(topics),
        repository.stargazerCount,
        repository.licenseInfo?.spdxId || null,
        repository.hasIssuesEnabled,
        repository.isArchived,
        repository.pushedAt
      ]
    });
  }
  await pool.query(`
    UPDATE repository_catalog
    SET is_enabled = FALSE, updated_at = NOW()
    WHERE source = 'deepwiki' AND source_seen_at < NOW() - INTERVAL '10 minutes'
  `);
  await pool.query("COMMIT");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}

console.log(`DeepWiki ${repositoryNames.length}개 중 GitHub 저장소 ${repositories.length}개를 동기화했습니다.`);
