import { useNavigate } from "react-router-dom";
import { MyPage } from "../components/MyPage";
import { MyPageLoginGate } from "../components/MyPageLoginGate";
import { useOssApp } from "../app/OssAppContext";

export function WorkspacePage() {
  const navigate = useNavigate();
  const {
    authUser,
    authLoading,
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

  return (
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
  );
}
