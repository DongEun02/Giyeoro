import { handleGithubPullRequestRequest } from "../server/githubPullRequestService.js";

export default function handler(request: any, response: any) {
  return handleGithubPullRequestRequest(request, response);
}
