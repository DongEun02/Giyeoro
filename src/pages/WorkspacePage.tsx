import { useNavigate } from "react-router-dom";
import { MyPage } from "../components/MyPage";
import { MyPageLoginGate } from "../components/MyPageLoginGate";
import { useOssApp } from "../app/OssAppContext";

export function WorkspacePage() {
  const navigate = useNavigate();
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
    openWorkspaceItem
  } = useOssApp();

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
      />
    </>
  );
}
