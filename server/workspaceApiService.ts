import { handleGithubPullRequestRequest } from "./githubPullRequestService.js";
import { handleGithubPullRequestSyncRequest } from "./githubPullRequestSyncService.js";
import type { GithubAuthOptions } from "./githubAuthService.js";
import { handlePublicPortfolioRequest } from "./publicPortfolioService.js";
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
  const operation = requestUrl.searchParams.get("operation");
  if (operation === "portfolio") {
    return handlePublicPortfolioRequest(request, response, options);
  }
  if (operation === "sync-pull-requests") {
    return handleGithubPullRequestSyncRequest(request, response, options);
  }
  if (operation === "pull-request") {
    return handleGithubPullRequestRequest(request, response, options);
  }
  return handleWorkspaceRequest(request, response, options);
};
