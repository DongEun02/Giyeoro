import { handleWorkspaceApiRequest } from "../server/workspaceApiService.js";

export default function handler(request: any, response: any) {
  return handleWorkspaceApiRequest(request, response);
}
