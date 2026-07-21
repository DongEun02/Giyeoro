import { handleGithubAuthCallbackRequest } from "../../../server/githubAuthService.js";

export default function handler(request: any, response: any) {
  return handleGithubAuthCallbackRequest(request, response);
}
