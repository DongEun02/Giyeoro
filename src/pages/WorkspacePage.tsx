import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MyPage } from "../components/MyPage";
import { MyPageLoginGate } from "../components/MyPageLoginGate";
import { useOssApp } from "../app/OssAppContext";
import type { IgnoredPullRequest, PullRequestSyncResult } from "../services/workspace";
import { hideRemoteRepository, restoreIgnoredRepository } from "../services/workspace";
import { createPublicPortfolioSnapshot } from "../services/publicPortfolio";

const EMPTY_SYNC_RESULT = {
  syncedAt: "",
  importedCount: 0,
  updatedCount: 0,
  scannedCount: 0,
  minimumStars: 50,
  truncated: false,
  ignoredItems: [] as IgnoredPullRequest[]
};

export function WorkspacePage() {
  const navigate = useNavigate();
  const [pullRequestSyncLoading, setPullRequestSyncLoading] = useState(false);
  const [pullRequestSyncProgress, setPullRequestSyncProgress] = useState(0);
  const [pullRequestSyncError, setPullRequestSyncError] = useState("");
  const [pullRequestSyncResult, setPullRequestSyncResult] = useState(() => EMPTY_SYNC_RESULT);
  const [updatingRepository, setUpdatingRepository] = useState("");
  const [portfolioCopied, setPortfolioCopied] = useState(false);
  const [portfolioShareLoading, setPortfolioShareLoading] = useState(false);
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
  const syncControllerRef = useRef<AbortController | null>(null);
  syncGithubPullRequestsRef.current = syncGithubPullRequests;
  triggerToastRef.current = triggerToast;

  const portfolioPath = authUser
    ? `/portfolio/${encodeURIComponent(authUser.login)}`
    : "/contributions";

  const handlePortfolioShare = async () => {
    if (portfolioShareLoading) return;
    setPortfolioShareLoading(true);
    setPortfolioCopied(false);
    try {
      const snapshotId = await createPublicPortfolioSnapshot();
      const shareUrl = new URL(`/share/${encodeURIComponent(snapshotId)}`, window.location.origin).toString();
      await navigator.clipboard.writeText(shareUrl);
      setPortfolioCopied(true);
      triggerToast("현재 포트폴리오를 공유본으로 저장하고 링크를 복사했습니다.");
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : "공유 링크를 만들지 못했습니다.");
    } finally {
      setPortfolioShareLoading(false);
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
    controller = new AbortController()
  ) => {
    if (syncControllerRef.current && !syncControllerRef.current.signal.aborted) return;
    syncControllerRef.current = controller;
    setPullRequestSyncLoading(true);
    setPullRequestSyncProgress(0);
    setPullRequestSyncError("");
    let importedCount = 0;
    let scannedCount = 0;
    try {
      let nextForce = force;
      while (!controller.signal.aborted) {
        const result = await syncGithubPullRequestsRef.current(nextForce, controller.signal) as PullRequestSyncResult;
        if (controller.signal.aborted) return;
        applySyncResult(result);
        if (result.synced) {
          importedCount += result.importedCount;
          scannedCount += result.scannedCount;
          setPullRequestSyncProgress(scannedCount);
        }
        if (!result.truncated) break;
        nextForce = false;
        await new Promise(resolve => window.setTimeout(resolve, 500));
      }
      if (controller.signal.aborted) return;
      if (announce) {
        triggerToastRef.current(
          importedCount > 0
            ? `새로운 GitHub PR ${importedCount}개를 가져왔습니다.`
            : "GitHub PR을 최신 상태로 확인했습니다."
        );
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error
        ? error.message
        : "GitHub에서 기여한 PR을 동기화하지 못했습니다.";
      setPullRequestSyncError(message);
      if (announce) triggerToastRef.current(message);
    } finally {
      if (syncControllerRef.current === controller) {
        syncControllerRef.current = null;
        if (!controller.signal.aborted) setPullRequestSyncLoading(false);
      }
    }
  }, [applySyncResult]);

  useEffect(() => {
    if (authLoading || !authUser || workspaceLoading) return undefined;
    const controller = new AbortController();
    void runPullRequestSync(false, false, controller);
    return () => controller.abort();
  }, [authLoading, authUser?.login, workspaceLoading, runPullRequestSync]);

  useEffect(() => () => syncControllerRef.current?.abort(), []);

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
        portfolioShareLoading={portfolioShareLoading}
        pullRequestSyncLoading={pullRequestSyncLoading}
        pullRequestSyncProgress={pullRequestSyncProgress}
        pullRequestSyncError={pullRequestSyncError}
        pullRequestSyncedAt={pullRequestSyncResult.syncedAt}
        pullRequestImportedCount={pullRequestSyncResult.importedCount}
        pullRequestScannedCount={pullRequestSyncResult.scannedCount}
        pullRequestSyncTruncated={pullRequestSyncResult.truncated}
        ignoredPullRequests={pullRequestSyncResult.ignoredItems}
        onPullRequestSync={() => runPullRequestSync(!pullRequestSyncResult.truncated, true)}
        updatingRepository={updatingRepository}
        onHideRepository={handleHideRepository}
        onRestoreRepository={handleRestoreRepository}
      />
    </>
  );
}
