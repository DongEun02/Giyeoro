import { useNavigate } from "react-router-dom";
import { MyPage } from "../components/MyPage";
import { useOssApp } from "../app/OssAppContext";

export function WorkspacePage() {
  const navigate = useNavigate();
  const {
    trackedTasks,
    myPageStatus,
    setMyPageStatus,
    updateWorkspaceStatus,
    removeWorkspaceItem,
    openWorkspaceItem
  } = useOssApp();

  return (
    <MyPage
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
