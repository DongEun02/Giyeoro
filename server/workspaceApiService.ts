import { handleGithubPullRequestRequest } from "./githubPullRequestService.js";
import type { GithubAuthOptions } from "./githubAuthService.js";
import { handleWorkspaceRequest } from "./workspaceService.js";

type WorkspaceApiOptions = GithubAuthOptions & {
  databaseUrl?: string;
  githubToken?: string;
};

export const handleWorkspaceApiRequest = (
  request: any,
  response: any,
  options: WorkspaceApiOptions = {}
) => {
  const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
  if (requestUrl.searchParams.get("operation") === "pull-request") {
    return handleGithubPullRequestRequest(request, response, options);
  }
  return handleWorkspaceRequest(request, response, options);
};
