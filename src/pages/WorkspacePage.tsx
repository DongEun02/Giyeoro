import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MyPage } from "../components/MyPage";
import { MyPageLoginGate } from "../components/MyPageLoginGate";
import { useOssApp } from "../app/OssAppContext";
import type { IgnoredPullRequest, PullRequestSyncResult } from "../services/workspace";
import { hideRemoteRepository, restoreIgnoredRepository } from "../services/workspace";

const EMPTY_SYNC_RESULT = {
  syncedAt: "",
  importedCount: 0,
  updatedCount: 0,
  scannedCount: 0,
  minimumStars: 100,
  truncated: false,
  ignoredItems: [] as IgnoredPullRequest[]
};

export function WorkspacePage() {
  const navigate = useNavigate();
  const [pullRequestSyncLoading, setPullRequestSyncLoading] = useState(false);
  const [pullRequestSyncError, setPullRequestSyncError] = useState("");
  const [pullRequestSyncResult, setPullRequestSyncResult] = useState(() => EMPTY_SYNC_RESULT);
  const [updatingRepository, setUpdatingRepository] = useState("");
  const [portfolioCopied, setPortfolioCopied] = useState(false);
  const {
    authUser,
    authLoading,
    workspaceLoading,
    workspaceError,
    trackedTasks,
    syncGithubPullRequests,
    openWorkspaceItem,
    triggerToast
  } = useOssApp();
  const syncGithubPullRequestsRef = useRef(syncGithubPullRequests);
  const triggerToastRef = useRef(triggerToast);
  syncGithubPullRequestsRef.current = syncGithubPullRequests;
  triggerToastRef.current = triggerToast;

  const portfolioPath = authUser
    ? `/portfolio/${encodeURIComponent(authUser.login)}`
    : "/mypage";

  const handlePortfolioShare = async () => {
    try {
      const shareUrl = new URL(portfolioPath, window.location.origin).toString();
      await navigator.clipboard.writeText(shareUrl);
      setPortfolioCopied(true);
      triggerToast("공개 포트폴리오 링크를 복사했습니다.");
    } catch {
      triggerToast("링크를 복사하지 못했습니다. 브라우저 권한을 확인해 주세요.");
    }
  };

  const applySyncResult = useCallback((result: PullRequestSyncResult) => {
    setPullRequestSyncResult({
      syncedAt: result.syncedAt,
      importedCount: result.importedCount,
      updatedCount: result.updatedCount,
      scannedCount: result.scannedCount,
      minimumStars: result.minimumStars,
      truncated: result.truncated,
      ignoredItems: result.ignoredItems
    });
  }, []);

  const runPullRequestSync = useCallback(async (
    force: boolean,
    announce: boolean,
    signal?: AbortSignal
  ) => {
    setPullRequestSyncLoading(true);
    setPullRequestSyncError("");
    try {
      const result = await syncGithubPullRequestsRef.current(force, signal) as PullRequestSyncResult;
      applySyncResult(result);
      if (announce) {
        triggerToastRef.current(
          result.importedCount > 0
            ? `새로운 GitHub PR ${result.importedCount}개를 가져왔습니다.`
            : "GitHub PR을 최신 상태로 확인했습니다."
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error
        ? error.message
        : "GitHub에서 기여한 PR을 동기화하지 못했습니다.";
      setPullRequestSyncError(message);
      if (announce) triggerToastRef.current(message);
    } finally {
      if (!signal?.aborted) setPullRequestSyncLoading(false);
    }
  }, [applySyncResult]);

  useEffect(() => {
    if (authLoading || !authUser || workspaceLoading) return undefined;
    const controller = new AbortController();
    void runPullRequestSync(false, false, controller.signal);
    return () => controller.abort();
  }, [authLoading, authUser?.login, workspaceLoading, runPullRequestSync]);

  const handleHideRepository = async (repo: string) => {
    if (updatingRepository) return;
    setUpdatingRepository(repo);
    setPullRequestSyncError("");
    try {
      await hideRemoteRepository(repo);
      const result = await syncGithubPullRequests(false) as PullRequestSyncResult;
      applySyncResult(result);
      triggerToast(`'${repo}' 프로젝트를 공개 목록에서 숨겼습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "프로젝트를 숨기지 못했습니다.";
      setPullRequestSyncError(message);
      triggerToast(message);
    } finally {
      setUpdatingRepository("");
    }
  };

  const handleRestoreRepository = async (repo: string) => {
    if (updatingRepository) return;
    setUpdatingRepository(repo);
    setPullRequestSyncError("");
    try {
      await restoreIgnoredRepository(repo);
      const result = await syncGithubPullRequests(true) as PullRequestSyncResult;
      applySyncResult(result);
      triggerToast(`'${repo}' 프로젝트를 다시 공개 목록에 추가했습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "프로젝트를 복구하지 못했습니다.";
      setPullRequestSyncError(message);
      triggerToast(message);
    } finally {
      setUpdatingRepository("");
    }
  };

  if (authLoading || !authUser) {
    return <MyPageLoginGate loading={authLoading} />;
  }

  if (workspaceLoading) {
    return (
      <div className="recommendation-status" role="status">
        <span className="recommendation-status-spinner" aria-hidden="true" />
        <div>
          <strong>내 작업 목록을 불러오고 있습니다.</strong>
          <span>저장된 관심 이슈와 진행 상태를 동기화하고 있어요.</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {workspaceError && (
        <div className="recommendation-status recommendation-status-error" role="alert">
          <div>
            <strong>작업 목록을 동기화하지 못했습니다.</strong>
            <span>{workspaceError}</span>
          </div>
        </div>
      )}
      <MyPage
        user={authUser}
        items={trackedTasks}
        onOpen={openWorkspaceItem}
        onOpenPortfolio={() => navigate(portfolioPath)}
        onSharePortfolio={handlePortfolioShare}
        portfolioCopied={portfolioCopied}
        pullRequestSyncLoading={pullRequestSyncLoading}
        pullRequestSyncError={pullRequestSyncError}
        pullRequestSyncedAt={pullRequestSyncResult.syncedAt}
        pullRequestImportedCount={pullRequestSyncResult.importedCount}
        pullRequestScannedCount={pullRequestSyncResult.scannedCount}
        pullRequestSyncTruncated={pullRequestSyncResult.truncated}
        ignoredPullRequests={pullRequestSyncResult.ignoredItems}
        onPullRequestSync={() => runPullRequestSync(true, true)}
        updatingRepository={updatingRepository}
        onHideRepository={handleHideRepository}
        onRestoreRepository={handleRestoreRepository}
      />
    </>
  );
}
