export type PersonalizedLanguage = {
  name: string;
  percentage: number;
};

export type PersonalizedRepository = {
  fullName: string;
  name: string;
  description: string;
  url: string;
  ownerAvatarUrl: string;
  language: string;
  languages: string[];
  topics: string[];
  stars: number;
  openIssues: number;
  contributionGuideUrl: string;
  activity: {
    level: string;
    label: string;
    pushedAt: string | null;
    daysSincePush: number | null;
  };
  contributorFriendliness: {
    level: string;
    label: string;
  };
  starterIssueCount: number;
  starterIssues: Array<{
    number: number;
    title: string;
    url: string;
  }>;
  matchedLanguages: string[];
  matchedDependencies: string[];
  matchScore: number;
  matchLevel: string;
  reasons: string[];
};

export type PersonalizedRepositoryResult = {
  user: { login: string };
  profile: {
    publicRepositoryCount: number;
    recentPublicEventCount: number;
    contributionEventCount: number;
    participatedRepositoryCount: number;
    analyzedManifestCount: number;
    topLanguages: PersonalizedLanguage[];
    dependencies: string[];
  };
  recommendations: PersonalizedRepository[];
  criteria: {
    publicOnly: boolean;
    eventWindowDays: number;
    repositoryActivityWindowDays: number;
  };
  loadedAt: string;
  loadedAtMs: number;
  cached: boolean;
  stale?: boolean;
};

type PersonalizedRepositoryOptions = {
  refresh?: boolean;
  signal?: AbortSignal;
};

export const fetchPersonalizedRepositories = async ({
  refresh = false,
  signal
}: PersonalizedRepositoryOptions = {}): Promise<PersonalizedRepositoryResult> => {
  const query = new URLSearchParams();
  if (refresh) query.set("refresh", "1");
  const response = await fetch(
    `/api/personalized-repositories${query.size > 0 ? `?${query}` : ""}`,
    { signal, headers: { Accept: "application/json" } }
  );
  const body = await response.json().catch(() => null) as ({ error?: string } & Partial<PersonalizedRepositoryResult>) | null;
  if (!response.ok) {
    throw new Error(body?.error || "맞춤 프로젝트 추천을 불러오지 못했습니다.");
  }
  if (!body || !Array.isArray(body.recommendations) || !body.profile) {
    throw new Error("맞춤 프로젝트 추천 응답이 올바르지 않습니다.");
  }
  return body as PersonalizedRepositoryResult;
};
