import { handleWorkspaceRequest } from "../server/workspaceService.js";

export default function handler(request: any, response: any) {
  return handleWorkspaceRequest(request, response);
}
