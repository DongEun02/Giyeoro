import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { MyPage } from "../components/MyPage";
import { MyPageLoginGate } from "../components/MyPageLoginGate";
import { useOssApp } from "../app/OssAppContext";
import { fetchGithubPullRequestByUrl } from "../services/githubPullRequest";

export function WorkspacePage() {
  const navigate = useNavigate();
  const [pullRequestUrl, setPullRequestUrl] = useState("");
  const [pullRequestLoading, setPullRequestLoading] = useState(false);
  const [pullRequestError, setPullRequestError] = useState("");
  const [portfolioCopied, setPortfolioCopied] = useState(false);
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
    savePullRequest,
    openWorkspaceItem,
    triggerToast
  } = useOssApp();

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

  const handlePullRequestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = pullRequestUrl.trim();
    if (!url || pullRequestLoading) return;

    setPullRequestLoading(true);
    setPullRequestError("");

    try {
      const result = await fetchGithubPullRequestByUrl(url);
      await savePullRequest(result);
      setPullRequestUrl("");
    } catch (error) {
      setPullRequestError(
        error instanceof Error ? error.message : "Pull Request를 저장하지 못했습니다."
      );
    } finally {
      setPullRequestLoading(false);
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
        onRemove={removeWorkspaceItem}
        onOpen={openWorkspaceItem}
        onBrowse={() => navigate("/issues")}
        onOpenPortfolio={() => navigate(portfolioPath)}
        onSharePortfolio={handlePortfolioShare}
        portfolioCopied={portfolioCopied}
        pullRequestUrl={pullRequestUrl}
        pullRequestLoading={pullRequestLoading}
        pullRequestError={pullRequestError}
        onPullRequestUrlChange={value => {
          setPullRequestUrl(value);
          if (pullRequestError) setPullRequestError("");
        }}
        onPullRequestSubmit={handlePullRequestSubmit}
      />
    </>
  );
}
