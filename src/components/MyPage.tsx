import { useMemo, useState } from "react";
import { BrandMark } from "./BrandMark";
import { Icons } from "./Icons";
import { getRepoVisual } from "../data/content";
import type { WorkspaceItem } from "../services/userWorkspace";
import type { AuthUser } from "../services/auth";
import type { IgnoredPullRequest } from "../services/workspace";
import { portfolioStatusFilters } from "../../shared/publicPortfolio";
import type { PortfolioStatusFilter } from "../../shared/publicPortfolio";

type MyPageProps = {
  user: AuthUser;
  items: Record<string, WorkspaceItem>;
  onOpenPortfolio: () => void;
  onSharePortfolio: (statuses: PortfolioStatusFilter[]) => void;
  portfolioStatuses: PortfolioStatusFilter[];
  onPortfolioStatusesChange: (statuses: PortfolioStatusFilter[]) => void;
  portfolioCopied: boolean;
  portfolioShareLoading: boolean;
  pullRequestSyncLoading: boolean;
  pullRequestSyncProgress: number;
  pullRequestSyncError: string;
  pullRequestSyncedAt: string;
  pullRequestImportedCount: number;
  pullRequestScannedCount: number;
  pullRequestSyncTruncated: boolean;
  ignoredPullRequests: IgnoredPullRequest[];
  onPullRequestSync: () => void;
  updatingRepository: string;
  onHideRepository: (repo: string) => void;
  onRestoreRepository: (repo: string) => void;
};

type RepositoryGroup = {
  repo: string;
  items: WorkspaceItem[];
  mergedCount: number;
  openCount: number;
  closedCount: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  repositoryStars: number;
  avatarUrl: string;
  languageTags: string[];
  lastUpdatedAt: string;
};

type PullRequestFilter = "all" | "merged" | "open" | "closed";

const syncDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
});
const contributionDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric", month: "short", day: "numeric"
});

const pullRequestState = (item: WorkspaceItem) => {
  if (item.data?.merged === true) return "Merged";
  if (item.data?.state === "closed") return "Closed";
  if (item.data?.state === "open") return "Open";
  return item.data?.closedAt ? "Closed" : "Open";
};

const groupPullRequests = (items: Record<string, WorkspaceItem>, filter: PullRequestFilter = "all"): RepositoryGroup[] => {
  const groups = new Map<string, WorkspaceItem[]>();
  Object.values(items).forEach(item => {
    if (item.kind !== "pull_request") return;
    if (Number(item.data?.repositoryStars || 0) < 50) return;
    if (filter !== "all" && pullRequestState(item).toLowerCase() !== filter) return;
    const group = groups.get(item.repo) || [];
    group.push(item);
    groups.set(item.repo, group);
  });
  return Array.from(groups, ([repo, pullRequests]) => {
    const sorted = [...pullRequests].sort((a, b) => new Date(b.data?.mergedAt || b.updatedAt).getTime() - new Date(a.data?.mergedAt || a.updatedAt).getTime());
    return {
      repo,
      items: sorted,
      mergedCount: sorted.filter(item => item.data?.merged === true).length,
      openCount: sorted.filter(item => pullRequestState(item) === "Open").length,
      closedCount: sorted.filter(item => pullRequestState(item) === "Closed").length,
      additions: sorted.reduce((sum, item) => sum + Number(item.data?.additions || 0), 0),
      deletions: sorted.reduce((sum, item) => sum + Number(item.data?.deletions || 0), 0),
      changedFiles: sorted.reduce((sum, item) => sum + Number(item.data?.changedFiles || 0), 0),
      repositoryStars: Math.max(...sorted.map(item => Number(item.data?.repositoryStars || 0))),
      avatarUrl: String(sorted[0]?.data?.repositoryAvatarUrl || ""),
      languageTags: Array.from(new Set(sorted.flatMap(item => item.languageTags))).slice(0, 3),
      lastUpdatedAt: String(sorted[0]?.data?.mergedAt || sorted[0]?.updatedAt || "")
    };
  }).sort((a, b) => (
    b.repositoryStars - a.repositoryStars
    || new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
  ));
};

export const MyPage = ({ user, items, onOpenPortfolio, onSharePortfolio, portfolioCopied, portfolioShareLoading,
  portfolioStatuses: shareStatuses, onPortfolioStatusesChange: setShareStatuses,
  pullRequestSyncLoading, pullRequestSyncProgress, pullRequestSyncError, pullRequestSyncedAt, pullRequestImportedCount,
  pullRequestScannedCount, pullRequestSyncTruncated, ignoredPullRequests, onPullRequestSync,
  updatingRepository, onHideRepository, onRestoreRepository }: MyPageProps) => {
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(() => new Set());
  const [statusFilter, setStatusFilter] = useState<PullRequestFilter>("all");
  const [lastSharedStatuses, setLastSharedStatuses] = useState("");
  const shareStatusKey = [...shareStatuses].sort().join(",");
  const selectedPortfolioCopied = portfolioCopied && shareStatusKey === lastSharedStatuses;
  const individualShareOptions = portfolioStatusFilters.filter(option => option.value !== "all");
  const allShareStatusesSelected = individualShareOptions.every(option => shareStatuses.includes(option.value));
  const repositories = useMemo(() => groupPullRequests(items), [items]);
  const visibleRepositories = useMemo(() => groupPullRequests(items, statusFilter), [items, statusFilter]);
  const ignoredRepositories = useMemo(() => {
    const counts = new Map<string, number>();
    ignoredPullRequests.forEach(item => counts.set(item.repo, (counts.get(item.repo) || 0) + 1));
    return Array.from(counts, ([repo, count]) => ({ repo, count }));
  }, [ignoredPullRequests]);
  const mergedCount = repositories.reduce((sum, repo) => sum + repo.mergedCount, 0);
  const openCount = repositories.reduce((sum, repo) => sum + repo.openCount, 0);
  const closedCount = repositories.reduce((sum, repo) => sum + repo.closedCount, 0);
  const statusFilters: { value: PullRequestFilter; label: string; count: number }[] = [
    { value: "all", label: "전체", count: mergedCount + openCount + closedCount },
    { value: "merged", label: "병합됨", count: mergedCount },
    { value: "open", label: "진행 중", count: openCount },
    { value: "closed", label: "닫힘", count: closedCount }
  ];
  const portfolioSummaryFilters = statusFilters.filter(option => option.value !== "all"
    && (shareStatuses.includes("all") || shareStatuses.includes(option.value)));
  const portfolioProjectCount = repositories.filter(project => project.items.some(item =>
    shareStatuses.includes("all") || shareStatuses.some(status => status === pullRequestState(item).toLowerCase())
  )).length;
  const savedPullRequestCount = Object.values(items).filter(item => item.kind === "pull_request").length;
  const syncedAtLabel = pullRequestSyncedAt ? syncDateFormatter.format(new Date(pullRequestSyncedAt)) : "아직 동기화 전";

  const toggleExpanded = (repo: string) => setExpandedRepos(current => {
    const next = new Set(current);
    if (next.has(repo)) next.delete(repo); else next.add(repo);
    return next;
  });

  return (
    <div className="mypage contribution-dashboard animate-fade-in">
      <header className="mypage-heading contribution-heading">
        <span>My Contributions</span><h1>내 오픈소스 기여</h1>
        <p>흩어진 GitHub PR을 프로젝트별로 모으고, 하나의 링크로 공유하세요.</p>
      </header>

      <section className="contribution-dashboard-summary" aria-label="포트폴리오 요약">
        <div className="mypage-profile">
          <a href={user.profileUrl} target="_blank" rel="noreferrer" className="mypage-profile-mark" aria-label={`${user.login} GitHub 프로필 열기`}>
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" width="42" height="42" referrerPolicy="no-referrer" /> : <BrandMark />}
          </a>
          <div><strong>{user.name}</strong><span>@{user.login}</span></div>
        </div>
        <div className="portfolio-summary-overview">
          <span className="portfolio-summary-title">포트폴리오 요약</span>
          <div className="contribution-summary-stats" role="status" aria-live="polite" aria-atomic="true">
            <div><strong>{portfolioProjectCount}</strong><span>프로젝트</span></div>
            {portfolioSummaryFilters.map(option => <div key={option.value}><strong>{option.count}</strong><span>{option.value === "merged" ? "병합된 PR" : option.value === "open" ? "진행 중 PR" : "닫힌 PR"}</span></div>)}
          </div>
        </div>
        <div className="portfolio-share-controls">
          <button type="button" className="mypage-portfolio-share-button" onClick={() => { setLastSharedStatuses(shareStatusKey); onSharePortfolio(shareStatuses); }} disabled={portfolioShareLoading || shareStatuses.length === 0}>
            {selectedPortfolioCopied ? <Icons.Check className="w-4 h-4" /> : <Icons.Clipboard className="w-4 h-4" />}
            {portfolioShareLoading ? "공유본 만드는 중" : selectedPortfolioCopied ? "링크 복사됨" : "포트폴리오 공유"}
          </button>
        </div>
      </section>

      <section className="mypage-pr-sync contribution-sync" aria-labelledby="sync-title">
        <div className="mypage-pr-sync-copy"><span>GitHub Sync</span><h2 id="sync-title">스타 50개 이상인 프로젝트의 PR을 모아요</h2><p>공개된 외부 저장소의 열린 PR과 병합된 PR을 가져와 프로젝트별로 정리합니다. 프로젝트 하나를 통째로 숨길 수도 있어요.</p></div>
        <div className="mypage-pr-sync-actions">
          <div className="mypage-pr-sync-status" aria-live="polite"><span>{pullRequestSyncLoading ? `GitHub PR 자동 확인 중${pullRequestSyncProgress ? ` · 이번 방문 ${pullRequestSyncProgress}개 확인` : ""}` : `최근 동기화 ${syncedAtLabel}`}</span><small>저장된 PR {savedPullRequestCount}개{!pullRequestSyncLoading && pullRequestSyncedAt ? ` · 마지막 동기화: ${pullRequestScannedCount}개 확인, ${pullRequestImportedCount}개 새로 저장${pullRequestSyncTruncated ? " · 이어서 확인 가능" : ""}` : ""}</small></div>
          <button type="button" onClick={onPullRequestSync} disabled={pullRequestSyncLoading}><Icons.Refresh className="w-4 h-4" />{pullRequestSyncLoading ? "확인 중" : pullRequestSyncError ? "다시 시도" : "지금 동기화"}</button>
        </div>
        {pullRequestSyncError ? <p className="mypage-pr-sync-error" role="alert">{pullRequestSyncError}</p> : null}
      </section>

      <section className="contribution-projects" aria-labelledby="projects-title">
        <div className="portfolio-display-settings">
          <div>
          <fieldset disabled={portfolioShareLoading} className="portfolio-share-statuses" aria-describedby="portfolio-display-help">
            <legend>포트폴리오 표시 설정</legend>
            {portfolioStatusFilters.map(option => <label key={option.value}>
              <input type="checkbox"
                checked={option.value === "all" ? allShareStatusesSelected : shareStatuses.includes(option.value)}
                onChange={event => {
                  const checked = event.target.checked;
                  setShareStatuses(option.value === "all"
                    ? checked ? individualShareOptions.map(status => status.value) : []
                    : checked ? [...shareStatuses, option.value] : shareStatuses.filter(status => status !== option.value));
                }} />
              {option.label}
            </label>)}
          </fieldset>
            <p id="portfolio-display-help">공개 페이지와 새로 만드는 공유본에 적용됩니다.</p>
            {shareStatuses.length === 0 ? <small role="status">표시할 상태를 하나 이상 선택해 주세요.</small> : null}
          </div>
          <button type="button" className="portfolio-display-preview" onClick={onOpenPortfolio} disabled={shareStatuses.length === 0}>공개 페이지 미리보기 <Icons.ArrowRight className="w-4 h-4" /></button>
        </div>
        <div className="contribution-section-heading"><div><span>Projects</span><h2 id="projects-title">프로젝트별 기여</h2></div></div>
        <div className="contribution-status-filters" role="group" aria-label="PR 상태 필터">
          {statusFilters.map(option => <button type="button" key={option.value} aria-pressed={statusFilter === option.value} onClick={() => { setStatusFilter(option.value); setExpandedRepos(new Set()); }}>{option.label}<span>{option.count}</span></button>)}
        </div>
        {visibleRepositories.length > 0 ? <div className="contribution-project-list">{visibleRepositories.map(project => {
          const expanded = expandedRepos.has(project.repo);
          const visibleItems = expanded ? project.items : project.items.slice(0, 3);
          return <article className="contribution-project-card" key={project.repo}>
            <header>
              <img src={project.avatarUrl || getRepoVisual(project.repo).image} alt="" referrerPolicy="no-referrer" />
              <div className="contribution-project-title"><span>{project.languageTags.join(" · ") || "Open Source"}</span><h3>{project.repo}</h3><p>★ {project.repositoryStars.toLocaleString()} · {project.mergedCount}개 병합 · {project.openCount}개 진행 중{project.closedCount ? ` · ${project.closedCount}개 닫힘` : ""} · 변경 파일 {project.changedFiles}개</p></div>
              <div className="contribution-project-diff" aria-label={`추가 ${project.additions.toLocaleString()}줄, 삭제 ${project.deletions.toLocaleString()}줄`}><span className="contribution-additions">+{project.additions.toLocaleString()}</span><span className="contribution-deletions">-{project.deletions.toLocaleString()}</span></div>
              <button type="button" className="contribution-hide-button" onClick={() => onHideRepository(project.repo)} disabled={!!updatingRepository}>{updatingRepository === project.repo ? "숨기는 중" : "프로젝트 숨기기"}</button>
            </header>
            <div className="contribution-pr-list">{visibleItems.map(item => { const state = pullRequestState(item); return <a className="contribution-pr-row" key={item.id} href={item.url || undefined} target="_blank" rel="noopener noreferrer"><span className={`is-${state.toLowerCase()}`}>{state}</span><strong>{item.title}</strong><small>#{item.data?.number || ""} · {contributionDateFormatter.format(new Date(item.data?.mergedAt || item.data?.closedAt || item.updatedAt))}</small><Icons.ArrowRight className="w-4 h-4" /></a>; })}</div>
            {project.items.length > 3 ? <button type="button" className="contribution-expand-button" onClick={() => toggleExpanded(project.repo)}>{expanded ? "대표 PR만 보기" : `전체 PR ${project.items.length}개 보기`}</button> : null}
          </article>;
        })}</div> : repositories.length > 0 ? <div className="mypage-empty"><Icons.GitPullRequest className="w-5 h-5" /><strong>해당 상태의 PR이 없습니다.</strong><p>다른 상태를 선택하거나 전체 PR을 확인해 보세요.</p><button type="button" onClick={() => setStatusFilter("all")}>전체 PR 보기</button></div> : <div className="mypage-empty"><Icons.GitPullRequest className="w-5 h-5" /><strong>아직 모은 PR이 없습니다.</strong><p>GitHub 동기화를 실행하면 프로젝트별 기여가 여기에 정리됩니다.</p><button type="button" onClick={onPullRequestSync}>GitHub PR 동기화</button></div>}
      </section>

      {ignoredRepositories.length > 0 ? <details className="contribution-hidden-projects"><summary>숨긴 프로젝트 {ignoredRepositories.length}개</summary><ul>{ignoredRepositories.map(project => <li key={project.repo}><div><strong>{project.repo}</strong><span>PR {project.count}개 숨김</span></div><button type="button" onClick={() => onRestoreRepository(project.repo)} disabled={!!updatingRepository}>{updatingRepository === project.repo ? "복구 중" : "다시 표시"}</button></li>)}</ul></details> : null}
    </div>
  );
};
