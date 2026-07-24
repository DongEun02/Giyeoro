export const WORKSPACE_STATUSES = [
  { value: "interested", label: "관심 작업" },
  { value: "in_progress", label: "진행 중" },
  { value: "completed", label: "기여 완료" }
];

export const WORKSPACE_STORAGE_KEY = "oss:workspace-items:v1";

export type WorkspaceItem = {
  id: string;
  kind: "issue" | "translation" | "pull_request";
  status: string;
  repo: string;
  title: string;
  summary: string;
  difficulty: string;
  workType: string;
  languageTags: string[];
  savedAt: string;
  updatedAt: string;
  url?: string;
  data: Record<string, any>;
};

export const indexWorkspaceItems = (items: WorkspaceItem[]) => Object.fromEntries(
  items.map(item => [item.id, item])
);

export const readLegacyWorkspaceItems = (): Record<string, WorkspaceItem> => {
  if (typeof window === "undefined") return {};

  try {
    const value = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, WorkspaceItem>
      : {};
  } catch {
    return {};
  }
};

export const writeLegacyWorkspaceItems = (items: Record<string, WorkspaceItem>) => {
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Login later can still sync the in-memory list when local storage is unavailable.
  }
};

export const clearLegacyWorkspaceItems = () => {
  try {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // The server remains the source of truth when local storage is unavailable.
  }
};

const createIssueData = (task: any) => ({
  id: task.id,
  source: task.source || "github-import",
  url: task.url,
  repo: task.repo,
  number: task.number,
  title: task.title,
  titleKo: task.titleKo,
  summary: task.summary,
  summaryKo: task.summaryKo,
  status: task.status || "Open",
  labels: task.labels || [],
  techs: task.techs || [],
  languageTags: task.languageTags || [],
  difficulty: task.difficulty || "난이도 미분류",
  difficultyLevel: task.difficultyLevel || "unlabeled",
  difficultySource: task.difficultySource || "",
  difficultyConfidence: task.difficultyConfidence || "",
  difficultyReason: task.difficultyReason || "",
  workType: task.workType || task.typeLabel || "유형 미분류",
  typeLabel: task.typeLabel || task.workType || "유형 미분류",
  repositoryAvatarUrl: task.repositoryAvatarUrl || "",
  contributionGuideUrl: task.contributionGuideUrl || "",
  author: task.author || { login: "unknown", avatarUrl: "", url: task.url },
  assignees: task.assignees || [],
  comments: task.comments || 0,
  relatedPullRequestCount: Number.isInteger(task.relatedPullRequestCount)
    ? task.relatedPullRequestCount
    : null,
  relatedPullRequestCountTruncated: !!task.relatedPullRequestCountTruncated,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  codexAnalysis: task.codexAnalysis || null,
  prs: [] as any[]
});

export const createWorkspaceItem = (task: any, kind: any): WorkspaceItem => {
  const savedAt = new Date().toISOString();

  if (kind === "translation") {
    return {
      id: task.id,
      kind,
      status: "interested",
      repo: task.repo,
      title: task.title,
      summary: task.summary,
      difficulty: task.difficulty,
      workType: "번역 작업",
      languageTags: task.languageTags || [],
      savedAt,
      updatedAt: savedAt,
      data: {
        repoKey: task.repoKey,
        docId: task.docId
      }
    };
  }

  return {
    id: task.id,
    kind: "issue",
    status: "interested",
    repo: task.repo,
    title: task.titleKo || task.title,
    summary: task.summaryKo || task.summary || "핵심 요약을 준비 중입니다.",
    difficulty: task.difficulty || "난이도 미분류",
    workType: task.workType || task.typeLabel || "유형 미분류",
    languageTags: task.languageTags || [],
    url: task.url,
    savedAt,
    updatedAt: savedAt,
    data: createIssueData(task)
  };
};

const plainTextFromMarkdown = (value: string) => value
  .replace(/```[\s\S]*?```/g, " ")
  .replace(/<!--([\s\S]*?)-->/g, " ")
  .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/<[^>]+>/g, " ")
  .replace(/[#>*_`~-]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const pullRequestSummary = (pullRequest: any) => {
  const body = plainTextFromMarkdown(String(pullRequest.body || ""));
  if (body) return body.length > 220 ? `${body.slice(0, 217).trim()}...` : body;
  return `변경 파일 ${pullRequest.changedFiles || 0}개 · +${pullRequest.additions || 0} / -${pullRequest.deletions || 0}`;
};

export const createPullRequestWorkspaceItem = ({
  pullRequest,
  repository
}: any): WorkspaceItem => {
  const savedAt = new Date().toISOString();
  const stateLabel = pullRequest.merged
    ? "병합됨"
    : pullRequest.draft
      ? "초안"
      : pullRequest.state === "open" ? "검토 중" : "닫힘";

  return {
    id: `github-pr-${pullRequest.repository}-${pullRequest.number}`,
    kind: "pull_request",
    status: pullRequest.state === "open" && !pullRequest.merged ? "in_progress" : "completed",
    repo: pullRequest.repository,
    title: pullRequest.title,
    summary: pullRequestSummary(pullRequest),
    difficulty: stateLabel,
    workType: "Pull Request",
    languageTags: repository.languageTags || [],
    url: pullRequest.url,
    savedAt,
    updatedAt: savedAt,
    data: {
      source: "github-pull-request",
      repositoryAvatarUrl: repository.ownerAvatarUrl || "",
      contributionGuideUrl: repository.contributionGuideUrl || "",
      number: pullRequest.number,
      author: pullRequest.author,
      state: pullRequest.state,
      draft: !!pullRequest.draft,
      merged: !!pullRequest.merged,
      mergedAt: pullRequest.mergedAt || null,
      closedAt: pullRequest.closedAt || null,
      createdAt: pullRequest.createdAt,
      updatedAt: pullRequest.updatedAt,
      additions: pullRequest.additions || 0,
      deletions: pullRequest.deletions || 0,
      changedFiles: pullRequest.changedFiles || 0,
      comments: pullRequest.comments || 0,
      reviewComments: pullRequest.reviewComments || 0,
      headBranch: pullRequest.headBranch || "",
      baseBranch: pullRequest.baseBranch || ""
    }
  };
};
