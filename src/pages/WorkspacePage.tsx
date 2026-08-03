import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MyPage } from "../components/MyPage";
import { MyPageLoginGate } from "../components/MyPageLoginGate";
import { useOssApp } from "../app/OssAppContext";
import type { WorkspaceItem } from "../services/userWorkspace";
import type { IgnoredPullRequest, PullRequestSyncResult } from "../services/workspace";

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
  const [restoringPullRequestId, setRestoringPullRequestId] = useState("");
  const [portfolioCopied, setPortfolioCopied] = useState(false);
  const autoSyncedLogin = useRef("");
  const {
    authUser,
    authLoading,
    workspaceLoading,
    workspaceError,
    trackedTasks,
    myPageStatus,
    setMyPageStatus,
    updateWorkspaceStatus,
    removeWorkspaceItem,
    syncGithubPullRequests,
    restoreGithubPullRequest,
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
    if (autoSyncedLogin.current === authUser.login) return undefined;
    autoSyncedLogin.current = authUser.login;
    const controller = new AbortController();
    void runPullRequestSync(false, false, controller.signal);
    return () => controller.abort();
  }, [authLoading, authUser?.login, workspaceLoading, runPullRequestSync]);

  const handleRemove = async (item: WorkspaceItem) => {
    try {
      await removeWorkspaceItem(item);
      if (item.kind !== "pull_request") return;
      setPullRequestSyncResult(current => ({
        ...current,
        ignoredItems: [
          {
            id: item.id,
            repo: item.repo,
            title: item.title,
            url: item.url || "",
            ignoredAt: new Date().toISOString()
          },
          ...current.ignoredItems.filter(ignored => ignored.id !== item.id)
        ]
      }));
    } catch {
      // App context restores the optimistic item and shows the server error.
    }
  };

  const handleRestorePullRequest = async (item: IgnoredPullRequest) => {
    if (restoringPullRequestId) return;
    setRestoringPullRequestId(item.id);
    setPullRequestSyncError("");
    try {
      const result = await restoreGithubPullRequest(item.id) as PullRequestSyncResult;
      applySyncResult(result);
      triggerToast(`'${item.title}' PR을 다시 가져왔습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "제외한 PR을 복구하지 못했습니다.";
      setPullRequestSyncError(message);
      triggerToast(message);
    } finally {
      setRestoringPullRequestId("");
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
        activeStatus={myPageStatus}
        onActiveStatusChange={setMyPageStatus}
        onStatusChange={updateWorkspaceStatus}
        onRemove={handleRemove}
        onOpen={openWorkspaceItem}
        onBrowse={() => navigate("/issues")}
        onOpenPortfolio={() => navigate(portfolioPath)}
        onSharePortfolio={handlePortfolioShare}
        portfolioCopied={portfolioCopied}
        pullRequestSyncLoading={pullRequestSyncLoading}
        pullRequestSyncError={pullRequestSyncError}
        pullRequestSyncedAt={pullRequestSyncResult.syncedAt}
        pullRequestImportedCount={pullRequestSyncResult.importedCount}
        pullRequestScannedCount={pullRequestSyncResult.scannedCount}
        pullRequestMinimumStars={pullRequestSyncResult.minimumStars}
        pullRequestSyncTruncated={pullRequestSyncResult.truncated}
        ignoredPullRequests={pullRequestSyncResult.ignoredItems}
        restoringPullRequestId={restoringPullRequestId}
        onPullRequestSync={() => runPullRequestSync(true, true)}
        onRestorePullRequest={handleRestorePullRequest}
      />
    </>
  );
}
