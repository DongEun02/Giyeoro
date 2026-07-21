import {
  readGithubSessionUser
} from "./githubAuthService.js";
import type { GithubAuthOptions } from "./githubAuthService.js";
import {
  fetchOpenSourceRepository,
  fetchRepositoryContributorFriendliness
} from "./githubRepositoryService.js";

type HandlerOptions = GithubAuthOptions & {
  githubToken?: string;
};

type GithubRepository = {
  full_name: string;
  name: string;
  description?: string | null;
  language?: string | null;
  languages_url?: string;
  fork?: boolean;
  archived?: boolean;
  disabled?: boolean;
  private?: boolean;
  pushed_at?: string | null;
  default_branch?: string;
};

type GithubEvent = {
  type?: string;
  repo?: { name?: string };
};

type GithubContent = {
  type?: string;
  name?: string;
  path?: string;
  url?: string;
};

type CandidateRepository = {
  fullName: string;
  languages: readonly string[];
  dependencyPatterns: readonly string[];
};

type LanguageSignal = {
  name: string;
  score: number;
  percentage: number;
};

const GITHUB_API_VERSION = "2022-11-28";
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_LANGUAGE_REPOSITORIES = 8;
const MAX_MANIFEST_REPOSITORIES = 6;
const MAX_PUBLIC_EVENTS = 300;
const MAX_CANDIDATES_TO_VERIFY = 10;
const MAX_RECOMMENDATIONS = 5;
const RELEVANT_EVENT_WEIGHTS: Record<string, number> = {
  PushEvent: 5,
  PullRequestEvent: 4,
  PullRequestReviewEvent: 3,
  IssuesEvent: 2,
  IssueCommentEvent: 1,
  CreateEvent: 2,
  ForkEvent: 1
};
const MANIFEST_FILE_NAMES = new Set([
  "package.json",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "requirements.txt",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod"
]);
const STARTER_LABEL_PATTERN = /good first issue|good-first-issue|beginner|first[- ]timers|help wanted|contributions welcome|easy|starter/i;

const CANDIDATE_REPOSITORIES: readonly CandidateRepository[] = [
  { fullName: "facebook/react", languages: ["JavaScript", "TypeScript"], dependencyPatterns: ["react", "react-dom"] },
  { fullName: "vercel/next.js", languages: ["TypeScript", "JavaScript"], dependencyPatterns: ["next"] },
  { fullName: "vitejs/vite", languages: ["TypeScript", "JavaScript"], dependencyPatterns: ["vite"] },
  { fullName: "vitest-dev/vitest", languages: ["TypeScript", "JavaScript"], dependencyPatterns: ["vitest"] },
  { fullName: "testing-library/react-testing-library", languages: ["JavaScript", "TypeScript"], dependencyPatterns: ["@testing-library/react"] },
  { fullName: "TanStack/query", languages: ["TypeScript", "JavaScript"], dependencyPatterns: ["@tanstack/react-query", "react-query"] },
  { fullName: "microsoft/TypeScript", languages: ["TypeScript", "JavaScript"], dependencyPatterns: ["typescript"] },
  { fullName: "typescript-eslint/typescript-eslint", languages: ["TypeScript"], dependencyPatterns: ["@typescript-eslint"] },
  { fullName: "DefinitelyTyped/DefinitelyTyped", languages: ["TypeScript"], dependencyPatterns: ["@types/"] },
  { fullName: "vuejs/core", languages: ["TypeScript", "JavaScript"], dependencyPatterns: ["vue"] },
  { fullName: "sveltejs/svelte", languages: ["TypeScript", "JavaScript"], dependencyPatterns: ["svelte"] },
  { fullName: "eslint/eslint", languages: ["JavaScript", "TypeScript"], dependencyPatterns: ["eslint"] },
  { fullName: "prettier/prettier", languages: ["JavaScript", "TypeScript"], dependencyPatterns: ["prettier"] },
  { fullName: "axios/axios", languages: ["JavaScript", "TypeScript"], dependencyPatterns: ["axios"] },
  { fullName: "expressjs/express", languages: ["JavaScript", "TypeScript"], dependencyPatterns: ["express"] },
  { fullName: "tailwindlabs/tailwindcss", languages: ["TypeScript", "JavaScript", "CSS"], dependencyPatterns: ["tailwindcss"] },
  { fullName: "nodejs/node", languages: ["JavaScript", "C++"], dependencyPatterns: ["node"] },
  { fullName: "spring-projects/spring-boot", languages: ["Java", "Kotlin"], dependencyPatterns: ["org.springframework.boot", "spring-boot"] },
  { fullName: "junit-team/junit5", languages: ["Java", "Kotlin"], dependencyPatterns: ["org.junit", "junit"] },
  { fullName: "mockito/mockito", languages: ["Java", "Kotlin"], dependencyPatterns: ["org.mockito", "mockito"] },
  { fullName: "JetBrains/kotlin", languages: ["Kotlin", "Java"], dependencyPatterns: ["org.jetbrains.kotlin", "kotlin-stdlib"] },
  { fullName: "Kotlin/kotlinx.coroutines", languages: ["Kotlin"], dependencyPatterns: ["kotlinx-coroutines"] },
  { fullName: "Kotlin/kotlinx.serialization", languages: ["Kotlin"], dependencyPatterns: ["kotlinx-serialization"] },
  { fullName: "android/nowinandroid", languages: ["Kotlin"], dependencyPatterns: ["androidx.", "com.android.application"] },
  { fullName: "kotest/kotest", languages: ["Kotlin"], dependencyPatterns: ["io.kotest", "kotest"] },
  { fullName: "pytest-dev/pytest", languages: ["Python"], dependencyPatterns: ["pytest"] },
  { fullName: "python/cpython", languages: ["Python", "C"], dependencyPatterns: ["python"] },
  { fullName: "python/typeshed", languages: ["Python"], dependencyPatterns: ["mypy", "typeshed"] },
  { fullName: "rust-lang/rust", languages: ["Rust"], dependencyPatterns: [] },
  { fullName: "tokio-rs/tokio", languages: ["Rust"], dependencyPatterns: ["tokio"] },
  { fullName: "golang/go", languages: ["Go"], dependencyPatterns: ["golang.org"] },
  { fullName: "gin-gonic/gin", languages: ["Go"], dependencyPatterns: ["github.com/gin-gonic/gin"] }
];

const responseCache = new Map<string, { cachedAt: number; value: any }>();

const jsonResponse = (response: any, status: number, body: unknown) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
};

const isLoopbackRequest = (request: any) => {
  const address = request.socket?.remoteAddress || "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
};

const getRequestUrl = (request: any) => new URL(request.url || "/", "http://127.0.0.1");

const githubHeaders = (githubToken?: string, accept = "application/vnd.github+json") => {
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "giyeoro-personalized-recommendations",
    "X-GitHub-Api-Version": GITHUB_API_VERSION
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
  return headers;
};

const githubJson = async <T>(path: string, githubToken?: string, optional = false): Promise<T | null> => {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: githubHeaders(githubToken),
    signal: AbortSignal.timeout(20_000)
  });
  if (optional && [404, 409].includes(response.status)) return null;
  if (response.status === 403 || response.status === 429) throw new Error("GITHUB_RATE_LIMIT");
  if (!response.ok) throw new Error("GITHUB_FETCH_FAILED");
  return await response.json() as T;
};

const addLanguageScore = (scores: Map<string, number>, language: string | null | undefined, score: number) => {
  const name = String(language || "").trim();
  if (!name || !Number.isFinite(score) || score <= 0) return;
  scores.set(name, (scores.get(name) || 0) + score);
};

const normalizeDependency = (value: string) => value
  .trim()
  .replace(/^['"]|['"]$/g, "")
  .replace(/\s+/g, "")
  .toLowerCase();

const parsePackageJson = (source: string) => {
  try {
    const manifest = JSON.parse(source) as Record<string, any>;
    return ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]
      .flatMap(key => Object.keys(manifest[key] || {}));
  } catch {
    return [];
  }
};

const parsePomXml = (source: string) => [...source.matchAll(/<dependency>[\s\S]*?<groupId>([^<]+)<\/groupId>[\s\S]*?<artifactId>([^<]+)<\/artifactId>[\s\S]*?<\/dependency>/gi)]
  .map(match => `${match[1]}:${match[2]}`);

const parseGradle = (source: string) => [
  ...[...source.matchAll(/["']([A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+)(?::[^"']+)?["']/g)].map(match => match[1]),
  ...[...source.matchAll(/id\s*\(?["']([^"']+)["']/g)].map(match => match[1])
];

const parseRequirements = (source: string) => source
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !line.startsWith("#") && !line.startsWith("-"))
  .map(line => line.split(/[<>=!~;\[]/, 1)[0]);

const parsePyproject = (source: string) => [
  ...[...source.matchAll(/^\s*([A-Za-z0-9_.-]+)\s*=\s*["'{]/gm)].map(match => match[1]),
  ...[...source.matchAll(/["']([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?(?:[<>=!~ ].*)?["']/g)].map(match => match[1])
];

const parseCargoToml = (source: string) => {
  const dependencies = source.match(/\[(?:dev-)?dependencies\]([\s\S]*?)(?=\n\[|$)/gi) || [];
  return dependencies.flatMap(section => (
    [...section.matchAll(/^\s*([A-Za-z0-9_-]+)\s*=/gm)].map(match => match[1])
  ));
};

const parseGoMod = (source: string) => [...source.matchAll(/^\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+)\s+v\d/gm)]
  .map(match => match[1]);

const parseManifest = (fileName: string, source: string) => {
  const normalizedName = fileName.toLowerCase();
  let dependencies: string[] = [];
  if (normalizedName === "package.json") dependencies = parsePackageJson(source);
  if (normalizedName === "pom.xml") dependencies = parsePomXml(source);
  if (normalizedName === "build.gradle" || normalizedName === "build.gradle.kts") dependencies = parseGradle(source);
  if (normalizedName === "requirements.txt") dependencies = parseRequirements(source);
  if (normalizedName === "pyproject.toml") dependencies = parsePyproject(source);
  if (normalizedName === "cargo.toml") dependencies = parseCargoToml(source);
  if (normalizedName === "go.mod") dependencies = parseGoMod(source);
  return [...new Set(dependencies.map(normalizeDependency).filter(Boolean))].slice(0, 80);
};

const fetchRepositoryLanguages = async (repository: GithubRepository, githubToken?: string) => {
  try {
    return await githubJson<Record<string, number>>(
      `/repos/${repository.full_name}/languages`,
      githubToken
    ) || {};
  } catch {
    return {};
  }
};

const fetchRepositoryMetadata = async (fullName: string, githubToken?: string) => {
  try {
    return await githubJson<GithubRepository>(`/repos/${fullName}`, githubToken, true);
  } catch {
    return null;
  }
};

const fetchPublicEvents = async (login: string, githubToken?: string) => {
  const pages = await Promise.all([1, 2, 3].map(page => (
    githubJson<GithubEvent[]>(
      `/users/${encodeURIComponent(login)}/events/public?per_page=100&page=${page}`,
      githubToken
    )
  )));
  return pages.flatMap(page => page || []).slice(0, MAX_PUBLIC_EVENTS);
};

const fetchManifestSignals = async (repository: GithubRepository, githubToken?: string) => {
  if (!repository.full_name || !repository.default_branch || repository.private || repository.archived) {
    return { repository: repository.full_name, manifests: [] as string[], dependencies: [] as string[] };
  }

  try {
    const rootContents = await githubJson<GithubContent[]>(
      `/repos/${repository.full_name}/contents?ref=${encodeURIComponent(repository.default_branch)}`,
      githubToken,
      true
    );
    if (!Array.isArray(rootContents)) {
      return { repository: repository.full_name, manifests: [], dependencies: [] };
    }

    const manifestFiles = rootContents
      .filter(item => item.type === "file" && MANIFEST_FILE_NAMES.has(item.name || "") && item.url)
      .slice(0, 2);
    const parsed = await Promise.all(manifestFiles.map(async file => {
      try {
        const response = await fetch(file.url as string, {
          headers: githubHeaders(githubToken, "application/vnd.github.raw+json"),
          signal: AbortSignal.timeout(12_000)
        });
        if (!response.ok) return [];
        const source = (await response.text()).slice(0, 250_000);
        return parseManifest(file.name || "", source);
      } catch {
        return [];
      }
    }));

    return {
      repository: repository.full_name,
      manifests: manifestFiles.map(file => file.name || "").filter(Boolean),
      dependencies: [...new Set(parsed.flat())].slice(0, 100)
    };
  } catch {
    return { repository: repository.full_name, manifests: [], dependencies: [] };
  }
};

const toLanguageSignals = (scores: Map<string, number>): LanguageSignal[] => {
  const total = [...scores.values()].reduce((sum, score) => sum + score, 0);
  if (total <= 0) return [];
  return [...scores.entries()]
    .map(([name, score]) => ({
      name,
      score,
      percentage: Math.max(1, Math.round((score / total) * 100))
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
};

const dependencyMatches = (dependency: string, pattern: string) => {
  const normalizedPattern = pattern.toLowerCase();
  if (normalizedPattern.endsWith("/")) return dependency.startsWith(normalizedPattern);
  return dependency === normalizedPattern
    || dependency.startsWith(`${normalizedPattern}@`)
    || dependency.includes(`${normalizedPattern}:`)
    || dependency.includes(normalizedPattern);
};

const preliminaryCandidateScore = (
  candidate: CandidateRepository,
  languages: LanguageSignal[],
  dependencies: string[]
) => {
  const candidateLanguages = new Set(candidate.languages.map(language => language.toLowerCase()));
  const matchedLanguages = languages.filter(language => candidateLanguages.has(language.name.toLowerCase()));
  const matchedDependencies = dependencies.filter(dependency => (
    candidate.dependencyPatterns.some(pattern => dependencyMatches(dependency, pattern))
  ));
  const languageScore = Math.min(35, matchedLanguages.reduce(
    (score, language) => score + language.percentage * 0.35,
    0
  ));
  const dependencyScore = Math.min(30, matchedDependencies.length * 10);
  return {
    candidate,
    matchedLanguages,
    matchedDependencies: matchedDependencies.slice(0, 4),
    score: 5 + languageScore + dependencyScore
  };
};

const fetchStarterIssues = async (fullName: string, githubToken?: string) => {
  try {
    const issues = await githubJson<any[]>(
      `/repos/${fullName}/issues?state=open&sort=updated&direction=desc&per_page=50`,
      githubToken
    ) || [];
    const starterIssues = issues.filter(issue => {
      if (issue.pull_request || issue.locked || (issue.assignees?.length || 0) > 0) return false;
      const labels = (issue.labels || []).map((label: any) => (
        typeof label === "string" ? label : label.name || ""
      ));
      return labels.some((label: string) => STARTER_LABEL_PATTERN.test(label));
    });
    return {
      count: starterIssues.length,
      issues: starterIssues.slice(0, 2).map(issue => ({
        number: issue.number,
        title: issue.title,
        url: issue.html_url
      }))
    };
  } catch {
    return { count: 0, issues: [] as Array<{ number: number; title: string; url: string }> };
  }
};

const matchLevel = (score: number) => {
  if (score >= 85) return "매우 잘 맞음";
  if (score >= 60) return "잘 맞음";
  return "탐색 추천";
};

const buildRecommendationReasons = ({
  matchedLanguages,
  matchedDependencies,
  repository,
  starterIssueCount,
  contributorFriendliness
}: any) => {
  const reasons: string[] = [];
  if (matchedDependencies.length > 0) {
    reasons.push(`참여 프로젝트에서 ${matchedDependencies.slice(0, 2).join(", ")} 의존성을 사용했어요.`);
  }
  if (matchedLanguages.length > 0) {
    reasons.push(`${matchedLanguages.slice(0, 2).map((language: LanguageSignal) => language.name).join("·")} 사용 경험과 맞아요.`);
  }
  if (starterIssueCount > 0) reasons.push(`담당자 없는 입문 라벨 이슈 ${starterIssueCount}개를 확인했어요.`);
  if (contributorFriendliness?.level === "friendly") reasons.push("최근 외부 PR에 관리자 응답이 꾸준한 편이에요.");
  if (repository.contributionGuideUrl) reasons.push("기여 가이드가 준비되어 있어 시작 절차를 확인하기 쉬워요.");
  if (repository.activity?.level === "active") reasons.push("최근 30일 안에 코드가 업데이트됐어요.");
  return reasons.slice(0, 3);
};

const analyzePublicProfile = async (login: string, githubToken?: string) => {
  const [repositoriesValue, eventsValue] = await Promise.all([
    githubJson<GithubRepository[]>(
      `/users/${encodeURIComponent(login)}/repos?type=owner&sort=pushed&direction=desc&per_page=100`,
      githubToken
    ),
    fetchPublicEvents(login, githubToken)
  ]);
  const repositories = (repositoriesValue || []).filter(repository => (
    !repository.private && !repository.archived && !repository.disabled
  ));
  const events = eventsValue || [];
  const languageScores = new Map<string, number>();

  repositories.filter(repository => !repository.fork).slice(0, 30).forEach(repository => {
    addLanguageScore(languageScores, repository.language, 1);
  });

  const languageRepositories = repositories
    .filter(repository => !repository.fork)
    .slice(0, MAX_LANGUAGE_REPOSITORIES);
  const languageBreakdowns = await Promise.all(
    languageRepositories.map(repository => fetchRepositoryLanguages(repository, githubToken))
  );
  languageBreakdowns.forEach(languages => {
    const totalBytes = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
    if (totalBytes <= 0) return;
    Object.entries(languages).forEach(([language, bytes]) => {
      addLanguageScore(languageScores, language, (bytes / totalBytes) * 2);
    });
  });

  const eventRepositoryScores = new Map<string, number>();
  events.forEach(event => {
    const fullName = event.repo?.name || "";
    const weight = RELEVANT_EVENT_WEIGHTS[event.type || ""] || 0;
    if (!fullName || weight <= 0) return;
    eventRepositoryScores.set(fullName, (eventRepositoryScores.get(fullName) || 0) + weight);
  });
  const rankedEventRepositories = [...eventRepositoryScores.entries()]
    .sort((a, b) => b[1] - a[1]);
  const ownedByName = new Map(repositories.map(repository => [repository.full_name, repository]));
  const manifestRepositoryNames = [...new Set([
    ...rankedEventRepositories.map(([fullName]) => fullName),
    ...repositories.filter(repository => !repository.fork).map(repository => repository.full_name)
  ])].slice(0, MAX_MANIFEST_REPOSITORIES);
  const manifestRepositories = await Promise.all(manifestRepositoryNames.map(async fullName => (
    ownedByName.get(fullName) || await fetchRepositoryMetadata(fullName, githubToken)
  )));

  manifestRepositories.forEach(repository => {
    if (!repository) return;
    const activityWeight = Math.min(10, eventRepositoryScores.get(repository.full_name) || 0) * 0.25;
    addLanguageScore(languageScores, repository.language, activityWeight);
  });
  const manifestSignals = await Promise.all(
    manifestRepositories.filter((repository): repository is GithubRepository => !!repository)
      .map(repository => fetchManifestSignals(repository, githubToken))
  );
  const dependencies = [...new Set(manifestSignals.flatMap(signal => signal.dependencies))].slice(0, 120);
  const analyzedManifests = manifestSignals.flatMap(signal => (
    signal.manifests.map(manifest => `${signal.repository}/${manifest}`)
  ));

  return {
    repositories,
    events,
    topLanguages: toLanguageSignals(languageScores),
    dependencies,
    analyzedManifests,
    participatedRepositories: rankedEventRepositories.map(([fullName]) => fullName)
  };
};

const createPersonalizedRecommendations = async (login: string, githubToken?: string) => {
  const profile = await analyzePublicProfile(login, githubToken);
  const excludedRepositories = new Set([
    ...profile.repositories.map(repository => repository.full_name.toLowerCase()),
    ...profile.participatedRepositories.map(repository => repository.toLowerCase())
  ]);
  const rankedCandidates = CANDIDATE_REPOSITORIES
    .filter(candidate => !excludedRepositories.has(candidate.fullName.toLowerCase()))
    .map(candidate => preliminaryCandidateScore(candidate, profile.topLanguages, profile.dependencies))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES_TO_VERIFY);

  const verifiedCandidates = (await Promise.all(rankedCandidates.map(async ranked => {
    try {
      const repository = await fetchOpenSourceRepository(ranked.candidate.fullName, githubToken);
      if (!repository.hasIssues || repository.openIssues <= 0 || repository.activity.level === "quiet") return null;
      const starterIssues = await fetchStarterIssues(repository.fullName, githubToken);
      const score = ranked.score
        + (repository.activity.level === "active" ? 10 : 5)
        + (repository.contributionGuideUrl ? 5 : 0)
        + Math.min(10, starterIssues.count * 4);
      return { ...ranked, repository, starterIssues, score };
    } catch {
      return null;
    }
  }))).filter((candidate): candidate is NonNullable<typeof candidate> => !!candidate)
    .sort((a, b) => b.score - a.score)
    .slice(0, 7);

  const withFriendliness = await Promise.all(verifiedCandidates.map(async candidate => {
    const contributorFriendliness = await fetchRepositoryContributorFriendliness(
      candidate.repository,
      githubToken
    );
    const friendlinessScore = contributorFriendliness.level === "friendly"
      ? 8
      : contributorFriendliness.level === "mixed" ? 4 : 0;
    return { ...candidate, contributorFriendliness, score: candidate.score + friendlinessScore };
  }));

  const recommendations = withFriendliness
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECOMMENDATIONS)
    .map(candidate => ({
      fullName: candidate.repository.fullName,
      name: candidate.repository.name,
      description: candidate.repository.description,
      url: candidate.repository.url,
      ownerAvatarUrl: candidate.repository.ownerAvatarUrl,
      language: candidate.repository.language,
      languages: candidate.repository.languageTags,
      topics: candidate.repository.topics,
      stars: candidate.repository.stars,
      openIssues: candidate.repository.openIssues,
      contributionGuideUrl: candidate.repository.contributionGuideUrl,
      activity: candidate.repository.activity,
      contributorFriendliness: candidate.contributorFriendliness,
      starterIssueCount: candidate.starterIssues.count,
      starterIssues: candidate.starterIssues.issues,
      matchedLanguages: candidate.matchedLanguages.map(language => language.name),
      matchedDependencies: candidate.matchedDependencies,
      matchScore: Math.min(100, Math.round(candidate.score)),
      matchLevel: matchLevel(candidate.score),
      reasons: buildRecommendationReasons({
        matchedLanguages: candidate.matchedLanguages,
        matchedDependencies: candidate.matchedDependencies,
        repository: candidate.repository,
        starterIssueCount: candidate.starterIssues.count,
        contributorFriendliness: candidate.contributorFriendliness
      })
    }));

  const loadedAtMs = Date.now();
  return {
    user: { login },
    profile: {
      publicRepositoryCount: profile.repositories.length,
      recentPublicEventCount: profile.events.length,
      contributionEventCount: profile.events.filter(event => !!RELEVANT_EVENT_WEIGHTS[event.type || ""]).length,
      participatedRepositoryCount: profile.participatedRepositories.length,
      analyzedManifestCount: profile.analyzedManifests.length,
      topLanguages: profile.topLanguages.map(({ score: _score, ...language }) => language),
      dependencies: profile.dependencies.slice(0, 12)
    },
    recommendations,
    criteria: {
      publicOnly: true,
      eventWindowDays: 30,
      repositoryActivityWindowDays: 90,
      checksLicense: true,
      checksContributionGuide: true,
      checksStarterIssues: true,
      checksExternalPullRequestResponses: true
    },
    loadedAt: new Date(loadedAtMs).toISOString(),
    loadedAtMs,
    cached: false
  };
};

const errorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (message === "GITHUB_RATE_LIMIT") return [429, "GitHub API 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."] as const;
  if (error instanceof Error && (error.name === "TimeoutError" || /timeout/i.test(message))) {
    return [504, "GitHub 공개 활동을 분석하는 시간이 초과됐습니다."] as const;
  }
  return [502, "GitHub 공개 활동을 분석하지 못했습니다."] as const;
};

export const handlePersonalizedRepositoriesRequest = async (
  request: any,
  response: any,
  options: HandlerOptions = {}
) => {
  if (options.enforceLoopback && !isLoopbackRequest(request)) {
    jsonResponse(response, 403, { error: "로컬 요청만 허용됩니다." });
    return;
  }
  if (request.method !== "GET") {
    jsonResponse(response, 405, { error: "GET 요청만 지원합니다." });
    return;
  }

  const user = readGithubSessionUser(request, options);
  if (!user) {
    jsonResponse(response, 401, { error: "맞춤 추천을 받으려면 GitHub 로그인이 필요합니다." });
    return;
  }

  const githubToken = options.githubToken || process.env.GITHUB_TOKEN;
  const requestUrl = getRequestUrl(request);
  const force = requestUrl.searchParams.get("refresh") === "1";
  const cacheKey = user.login.toLowerCase();
  const cached = responseCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    jsonResponse(response, 200, { ...cached.value, cached: true });
    return;
  }

  try {
    const result = await createPersonalizedRecommendations(user.login, githubToken);
    responseCache.set(cacheKey, { value: result, cachedAt: Date.now() });
    jsonResponse(response, 200, result);
  } catch (error) {
    if (cached) {
      jsonResponse(response, 200, { ...cached.value, cached: true, stale: true });
      return;
    }
    const [status, message] = errorMessage(error);
    console.error(`[GitHub personalized recommendations] ${status}: ${message}`);
    jsonResponse(response, status, { error: message });
  }
};
