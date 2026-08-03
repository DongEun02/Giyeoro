import { useEffect, useRef, useState } from "react";
import { BrandMark } from "./BrandMark";
import { Icons } from "./Icons";
import { getRepoVisual } from "../data/content";
import { WORKSPACE_STATUSES } from "../services/userWorkspace";
import type { WorkspaceItem } from "../services/userWorkspace";
import type { AuthUser } from "../services/auth";
import type { IgnoredPullRequest } from "../services/workspace";

type MyPageProps = {
  user: AuthUser;
  items: Record<string, WorkspaceItem>;
  activeStatus: string;
  onActiveStatusChange: (status: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onRemove: (item: WorkspaceItem) => void;
  onOpen: (item: WorkspaceItem) => void;
  onBrowse: () => void;
  onOpenPortfolio: () => void;
  onSharePortfolio: () => void;
  portfolioCopied: boolean;
  pullRequestSyncLoading: boolean;
  pullRequestSyncError: string;
  pullRequestSyncedAt: string;
  pullRequestImportedCount: number;
  pullRequestScannedCount: number;
  pullRequestMinimumStars: number;
  pullRequestSyncTruncated: boolean;
  ignoredPullRequests: IgnoredPullRequest[];
  restoringPullRequestId: string;
  onPullRequestSync: () => void;
  onRestorePullRequest: (item: IgnoredPullRequest) => void;
};

const syncDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const PAGE_SIZE = 20;

const createPageItems = (currentPage: number, totalPages: number) => {
  const pages = Array.from(new Set([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1
  ].filter(page => page >= 1 && page <= totalPages))).sort((a, b) => a - b);

  return pages.flatMap((page, index) => {
    const previousPage = pages[index - 1];
    return index > 0 && page - previousPage > 1
      ? [`ellipsis-${previousPage}-${page}`, page]
      : [page];
  });
};

export const MyPage = ({
  user,
  items,
  activeStatus,
  onActiveStatusChange,
  onStatusChange,
  onRemove,
  onOpen,
  onBrowse,
  onOpenPortfolio,
  onSharePortfolio,
  portfolioCopied,
  pullRequestSyncLoading,
  pullRequestSyncError,
  pullRequestSyncedAt,
  pullRequestImportedCount,
  pullRequestScannedCount,
  pullRequestMinimumStars,
  pullRequestSyncTruncated,
  ignoredPullRequests,
  restoringPullRequestId,
  onPullRequestSync,
  onRestorePullRequest
}: MyPageProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const workspaceHeadingRef = useRef<HTMLDivElement>(null);
  const allItems = Object.values(items).sort((a, b) => (
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ));
  const counts: Record<string, number> = WORKSPACE_STATUSES.reduce((result, status) => ({
    ...result,
    [status.value]: allItems.filter(item => item.status === status.value).length
  }), {} as Record<string, number>);
  const visibleItems = allItems.filter(item => item.status === activeStatus);
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedItems = visibleItems.slice(
    (activePage - 1) * PAGE_SIZE,
    activePage * PAGE_SIZE
  );
  const pageItems = createPageItems(activePage, totalPages);
  const publicItemCount = allItems.filter(item => (
    item.status === "completed"
    && (item.kind === "issue" || (item.kind === "pull_request" && item.data?.merged === true))
  )).length;
  const activeLabel = WORKSPACE_STATUSES.find(status => status.value === activeStatus)?.label || "저장한 작업";
  const syncedAtLabel = pullRequestSyncedAt
    ? syncDateFormatter.format(new Date(pullRequestSyncedAt))
    : "아직 동기화 전";

  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);

  const handleStatusTabChange = (status: string) => {
    setCurrentPage(1);
    onActiveStatusChange(status);
  };

  const handlePageChange = (page: number) => {
    if (page === activePage || page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.requestAnimationFrame(() => {
      workspaceHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="mypage animate-fade-in">
      <header className="mypage-heading">
        <span>기여로 작업실</span>
        <h1>내 기여 현황</h1>
        <p>관심 있는 작업을 저장하고 기여 진행 상태를 한곳에서 관리합니다.</p>
      </header>

      <section className="mypage-overview" aria-label="기여 현황 요약">
        <div className="mypage-profile">
          <a
            href={user.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="mypage-profile-mark"
            aria-label={`${user.login} GitHub 프로필 열기`}
          >
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" width="42" height="42" referrerPolicy="no-referrer" />
              : <BrandMark />}
          </a>
          <div>
            <strong>{user.name}</strong>
            <span>@{user.login} · GitHub 계정에 저장된 작업 기준</span>
          </div>
        </div>

        <div className="mypage-stats">
          {WORKSPACE_STATUSES.map(status => (
            <div key={status.value}>
              <strong>{counts[status.value]}</strong>
              <span>{status.label}</span>
            </div>
          ))}
        </div>

        <button type="button" className="mypage-browse-button" onClick={onBrowse}>
          새 이슈 찾기
          <Icons.ArrowRight className="w-3.5 h-3.5" />
        </button>
      </section>

      <section className="mypage-portfolio-share" aria-labelledby="mypage-portfolio-title">
        <div className="mypage-portfolio-copy">
          <span>Public Portfolio</span>
          <h2 id="mypage-portfolio-title">완료한 기여를 링크로 공유하세요</h2>
          <p>
            공개 페이지에는 완료 처리한 이슈와 GitHub에서 병합된 PR만 표시됩니다.
            방문자는 내용을 볼 수만 있고 추가·삭제·상태 변경은 할 수 없어요.
          </p>
        </div>
        <div className="mypage-portfolio-actions">
          <span>현재 공개되는 기여 <strong>{publicItemCount}개</strong></span>
          <div>
            <button type="button" className="mypage-portfolio-preview" onClick={onOpenPortfolio}>
              공개 페이지 보기
              <Icons.ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="mypage-portfolio-share-button" onClick={onSharePortfolio}>
              {portfolioCopied
                ? <Icons.Check className="w-3.5 h-3.5" />
                : <Icons.Clipboard className="w-3.5 h-3.5" />}
              {portfolioCopied ? "링크 복사됨" : "공유 링크 복사"}
            </button>
          </div>
        </div>
      </section>

      <section className="mypage-pr-sync" aria-labelledby="mypage-pr-sync-title">
        <div className="mypage-pr-sync-copy">
          <span>GitHub Pull Request</span>
          <h2 id="mypage-pr-sync-title">기여한 PR 자동으로 가져오기</h2>
          <p>
            내가 작성한 공개 PR 중 라이선스가 확인되고 별이 {pullRequestMinimumStars}개 이상인
            오픈소스 저장소의 기여를 자동으로 찾아 저장합니다.
          </p>
        </div>
        <div className="mypage-pr-sync-actions">
          <div className="mypage-pr-sync-status" aria-live="polite">
            <span>{pullRequestSyncLoading ? "GitHub에서 확인 중" : `최근 동기화 ${syncedAtLabel}`}</span>
            {pullRequestSyncedAt && !pullRequestSyncLoading ? (
              <small>
                {pullRequestScannedCount > 0 ? `최근 PR ${pullRequestScannedCount}개 확인 · ` : ""}
                새로 저장 {pullRequestImportedCount}개
                {pullRequestSyncTruncated ? " · 최근 300개 기준" : ""}
              </small>
            ) : null}
          </div>
          <button type="button" onClick={onPullRequestSync} disabled={pullRequestSyncLoading}>
            <Icons.Refresh className="w-3.5 h-3.5" />
            {pullRequestSyncLoading ? "동기화 중" : "지금 새로고침"}
          </button>
        </div>
        {pullRequestSyncError ? (
          <p className="mypage-pr-sync-error" role="alert">{pullRequestSyncError}</p>
        ) : null}
        {ignoredPullRequests.length > 0 ? (
          <details className="mypage-pr-ignored">
            <summary>자동 가져오기에서 제외한 PR {ignoredPullRequests.length}개</summary>
            <ul>
              {ignoredPullRequests.map(item => (
                <li key={item.id}>
                  <div>
                    <span>{item.repo}</span>
                    <strong>{item.title}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestorePullRequest(item)}
                    disabled={!!restoringPullRequestId}
                  >
                    {restoringPullRequestId === item.id ? "복구 중" : "다시 가져오기"}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div className="mypage-status-tabs" role="tablist" aria-label="기여 진행 상태">
        {WORKSPACE_STATUSES.map(status => (
          <button
            key={status.value}
            type="button"
            role="tab"
            aria-selected={activeStatus === status.value}
            onClick={() => handleStatusTabChange(status.value)}
            className={activeStatus === status.value ? "mypage-status-tab-active" : ""}
          >
            <span>{status.label}</span>
            <strong>{counts[status.value]}</strong>
          </button>
        ))}
      </div>

      <section className="mypage-workspace" aria-labelledby="mypage-list-heading">
        <div className="mypage-list-heading" ref={workspaceHeadingRef}>
          <h2 id="mypage-list-heading">{activeLabel}</h2>
          <span>
            {visibleItems.length}개
            {totalPages > 1 ? ` · ${activePage}/${totalPages} 페이지` : ""}
          </span>
        </div>

        {visibleItems.length > 0 ? (
          <>
            <div className="mypage-list">
              {paginatedItems.map(item => (
                <article className="mypage-item" key={item.id}>
                <img
                  src={item.data?.repositoryAvatarUrl || getRepoVisual(item.repo).image}
                  alt=""
                  className="mypage-item-logo"
                  referrerPolicy="no-referrer"
                />

                <div className="mypage-item-main">
                  <div className="mypage-item-eyebrow">
                    <span>{item.repo}</span>
                    <span>
                      {item.kind === "translation"
                        ? "번역 작업"
                        : item.kind === "pull_request" ? "Pull Request" : "코드 이슈"}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <div className="mypage-item-meta">
                    <span>{item.difficulty}</span>
                    <span>{item.workType}</span>
                    {item.languageTags.slice(0, 2).map(language => <span key={language}>{language}</span>)}
                    {item.kind === "issue" && (
                      <span className={(item.data?.assignees?.length || 0) > 0 ? "mypage-assigned" : "mypage-available"}>
                        {(item.data?.assignees?.length || 0) > 0
                          ? `담당자 ${item.data.assignees.length}명`
                          : "담당자 없음"}
                      </span>
                    )}
                    {item.kind === "pull_request" && (
                      <>
                        <span>@{item.data?.author?.login || user.login}</span>
                        <span>변경 파일 {item.data?.changedFiles || 0}개</span>
                        <span className="mypage-pr-diff">
                          +{item.data?.additions || 0} / -{item.data?.deletions || 0}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mypage-item-controls">
                  <label>
                    <span>진행 상태</span>
                    <select
                      value={item.status}
                      onChange={event => onStatusChange(item.id, event.target.value)}
                      aria-label={`${item.title} 진행 상태`}
                    >
                      {WORKSPACE_STATUSES.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <button type="button" className="mypage-open-button" onClick={() => onOpen(item)}>
                      {item.kind === "pull_request" ? "GitHub에서 보기" : "열기"}
                    </button>
                    <button
                      type="button"
                      className="mypage-remove-button"
                      onClick={() => onRemove(item)}
                      aria-label={`${item.title} ${item.kind === "pull_request" ? "삭제하고 자동 가져오기에서 제외" : "목록에서 삭제"}`}
                      title={item.kind === "pull_request" ? "삭제 후 자동 가져오기에서 제외" : "목록에서 삭제"}
                    >
                      {item.kind === "pull_request"
                        ? <Icons.Trash className="w-4 h-4" />
                        : <Icons.Bookmark filled className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                </article>
              ))}
            </div>
            {totalPages > 1 ? (
              <nav className="mypage-pagination" aria-label={`${activeLabel} 페이지 이동`}>
                <button
                  type="button"
                  onClick={() => handlePageChange(activePage - 1)}
                  disabled={activePage === 1}
                  aria-label="이전 페이지"
                >
                  <Icons.ArrowLeft className="w-3.5 h-3.5" />
                  <span>이전</span>
                </button>
                <div>
                  {pageItems.map(page => typeof page === "number" ? (
                    <button
                      key={page}
                      type="button"
                      className={page === activePage ? "mypage-pagination-active" : ""}
                      aria-current={page === activePage ? "page" : undefined}
                      aria-label={`${page}페이지`}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={page} aria-hidden="true">…</span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handlePageChange(activePage + 1)}
                  disabled={activePage === totalPages}
                  aria-label="다음 페이지"
                >
                  <span>다음</span>
                  <Icons.ArrowRight className="w-3.5 h-3.5" />
                </button>
              </nav>
            ) : null}
          </>
        ) : (
          <div className="mypage-empty">
            <Icons.Bookmark className="w-5 h-5" />
            <strong>{activeLabel}가 없습니다.</strong>
            <p>이슈를 북마크하거나 위에서 GitHub PR을 동기화해 보세요.</p>
            <button type="button" onClick={onBrowse}>이슈 둘러보기</button>
          </div>
        )}
      </section>
    </div>
  );
};
