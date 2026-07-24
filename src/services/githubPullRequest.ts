export type GithubPullRequest = {
  repository: string;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  mergedAt: string | null;
  closedAt: string | null;
  author: {
    login: string;
    avatarUrl: string;
    url: string;
  };
  url: string;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  comments: number;
  reviewComments: number;
  headBranch: string;
  baseBranch: string;
};

export type GithubPullRequestResult = {
  pullRequest: GithubPullRequest;
  repository: {
    fullName: string;
    languageTags: string[];
    ownerAvatarUrl: string;
    contributionGuideUrl: string;
  };
};

export const fetchGithubPullRequestByUrl = async (
  pullRequestUrl: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<GithubPullRequestResult> => {
  const response = await fetch(
    `/api/github-pull-request?url=${encodeURIComponent(pullRequestUrl)}`,
    {
      signal,
      headers: { Accept: "application/json" }
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "GitHub Pull Request를 불러오지 못했습니다.");
  }
  if (
    !data.pullRequest?.url
    || !data.pullRequest?.repository
    || !Number.isInteger(data.pullRequest?.number)
    || !data.repository?.fullName
  ) {
    throw new Error("GitHub Pull Request 응답이 올바르지 않습니다.");
  }

  return data as GithubPullRequestResult;
};
