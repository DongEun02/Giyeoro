export type PublicPortfolioProfile = {
  login: string;
  name: string;
  avatarUrl: string;
  profileUrl: string;
};

export type PublicPortfolioItem = {
  id: string;
  kind: "issue" | "pull_request";
  repo: string;
  title: string;
  summary: string;
  difficulty: string;
  workType: string;
  languageTags: string[];
  url: string;
  completedAt: string;
  repositoryAvatarUrl: string;
  number: number;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  mergedAt?: string;
  authorLogin?: string;
};

export type PublicPortfolio = {
  profile: PublicPortfolioProfile;
  items: PublicPortfolioItem[];
};

export const fetchPublicPortfolio = async (
  login: string,
  signal?: AbortSignal
): Promise<PublicPortfolio> => {
  const parameters = new URLSearchParams({ operation: "portfolio", login });
  const response = await fetch(`/api/workspace?${parameters.toString()}`, {
    headers: { Accept: "application/json" },
    signal
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "공개 포트폴리오를 불러오지 못했습니다.");
  }
  if (!data.profile?.login || !Array.isArray(data.items)) {
    throw new Error("공개 포트폴리오 응답이 올바르지 않습니다.");
  }

  return data as PublicPortfolio;
};

export const createPublicPortfolioSnapshot = async (): Promise<string> => {
  const response = await fetch("/api/workspace?operation=portfolio-snapshot", {
    method: "POST",
    headers: { Accept: "application/json" }
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "공유용 포트폴리오를 만들지 못했습니다.");
  }
  if (typeof data.snapshotId !== "string" || !data.snapshotId) {
    throw new Error("공유 링크 응답이 올바르지 않습니다.");
  }
  return data.snapshotId;
};

export const fetchPublicPortfolioSnapshot = async (
  snapshotId: string,
  signal?: AbortSignal
): Promise<PublicPortfolio> => {
  const parameters = new URLSearchParams({ operation: "portfolio-snapshot", id: snapshotId });
  const response = await fetch(`/api/workspace?${parameters.toString()}`, {
    headers: { Accept: "application/json" },
    signal
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "공유된 포트폴리오를 열지 못했습니다.");
  }
  if (!data.profile?.login || !Array.isArray(data.items)) {
    throw new Error("공유된 포트폴리오 응답이 올바르지 않습니다.");
  }
  return data as PublicPortfolio;
};
