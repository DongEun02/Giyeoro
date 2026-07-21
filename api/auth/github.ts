import { handleGithubAuthStartRequest } from "../../server/githubAuthService.js";

export default function handler(request: any, response: any) {
  return handleGithubAuthStartRequest(request, response);
}
