import React from "react";
import { BrandMark } from "./BrandMark";
import { Icons } from "./Icons";
import { getRepoVisual } from "../data/content";
import { WORKSPACE_STATUSES } from "../services/userWorkspace";
import type { WorkspaceItem } from "../services/userWorkspace";
import type { AuthUser } from "../services/auth";
import type { FormEvent } from "react";

type MyPageProps = {
  user: AuthUser;
  items: Record<string, WorkspaceItem>;
  activeStatus: string;
  onActiveStatusChange: (status: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onRemove: (item: WorkspaceItem) => void;
  onOpen: (item: WorkspaceItem) => void;
  onBrowse: () => void;
  pullRequestUrl: string;
  pullRequestLoading: boolean;
  pullRequestError: string;
  onPullRequestUrlChange: (value: string) => void;
  onPullRequestSubmit: (event: FormEvent<HTMLFormElement>) => void;
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
  pullRequestUrl,
  pullRequestLoading,
  pullRequestError,
  onPullRequestUrlChange,
  onPullRequestSubmit
}: MyPageProps) => {
  const allItems = Object.values(items).sort((a, b) => (
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ));
  const counts: Record<string, number> = WORKSPACE_STATUSES.reduce((result, status) => ({
    ...result,
    [status.value]: allItems.filter(item => item.status === status.value).length
  }), {} as Record<string, number>);
  const visibleItems = allItems.filter(item => item.status === activeStatus);
  const activeLabel = WORKSPACE_STATUSES.find(status => status.value === activeStatus)?.label || "저장한 작업";

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

      <section className="mypage-pr-import" aria-labelledby="mypage-pr-import-title">
        <div className="mypage-pr-import-copy">
          <span>GitHub Pull Request</span>
          <h2 id="mypage-pr-import-title">기여한 PR 저장하기</h2>
          <p>내가 작성한 PR 링크를 입력하면 현재 상태와 변경 정보를 불러와 작업실에 저장합니다.</p>
        </div>
        <form className="mypage-pr-import-form" onSubmit={onPullRequestSubmit}>
          <label htmlFor="mypage-pr-url">Pull Request URL</label>
          <div>
            <input
              id="mypage-pr-url"
              type="url"
              inputMode="url"
              value={pullRequestUrl}
              onChange={event => onPullRequestUrlChange(event.target.value)}
              placeholder="https://github.com/owner/repository/pull/123"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              disabled={pullRequestLoading}
              aria-describedby={pullRequestError ? "mypage-pr-error" : "mypage-pr-note"}
              aria-invalid={!!pullRequestError}
              required
            />
            <button type="submit" disabled={pullRequestLoading || !pullRequestUrl.trim()}>
              {pullRequestLoading ? "불러오는 중" : "PR 저장"}
            </button>
          </div>
          {pullRequestError ? (
            <p id="mypage-pr-error" className="mypage-pr-import-error" role="alert">
              {pullRequestError}
            </p>
          ) : (
            <p id="mypage-pr-note" className="mypage-pr-import-note">
              현재 로그인한 GitHub 계정으로 만든 공개 오픈소스 PR을 저장할 수 있어요.
            </p>
          )}
        </form>
      </section>

      <div className="mypage-status-tabs" role="tablist" aria-label="기여 진행 상태">
        {WORKSPACE_STATUSES.map(status => (
          <button
            key={status.value}
            type="button"
            role="tab"
            aria-selected={activeStatus === status.value}
            onClick={() => onActiveStatusChange(status.value)}
            className={activeStatus === status.value ? "mypage-status-tab-active" : ""}
          >
            <span>{status.label}</span>
            <strong>{counts[status.value]}</strong>
          </button>
        ))}
      </div>

      <section className="mypage-workspace" aria-labelledby="mypage-list-heading">
        <div className="mypage-list-heading">
          <h2 id="mypage-list-heading">{activeLabel}</h2>
          <span>{visibleItems.length}개</span>
        </div>

        {visibleItems.length > 0 ? (
          <div className="mypage-list">
            {visibleItems.map(item => (
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
                      aria-label={`${item.title} 목록에서 삭제`}
                      title="목록에서 삭제"
                    >
                      <Icons.Bookmark filled className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mypage-empty">
            <Icons.Bookmark className="w-5 h-5" />
            <strong>{activeLabel}가 없습니다.</strong>
            <p>이슈를 북마크하거나 위에서 내가 기여한 PR을 등록해 보세요.</p>
            <button type="button" onClick={onBrowse}>이슈 둘러보기</button>
          </div>
        )}
      </section>
    </div>
  );
};
