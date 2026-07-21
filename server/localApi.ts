import { handleAnalyzeIssueRequest, handleGithubIssueRequest } from "./issueAnalysisService.js";
import {
  handleCategoryIssuesRequest,
  handleRepositoryIssuesRequest
} from "./githubRecommendationsService.js";
import { handleTranslationStatusRequest } from "./translationStatusService.js";
import { handleContributionGuideRequest } from "./contributionGuideService.js";
import {
  handleGithubAuthCallbackRequest,
  handleGithubAuthStartRequest,
  handleGithubLogoutRequest,
  handleGithubSessionRequest
} from "./githubAuthService.js";

export const localApiPlugin = (options: any) => ({
  name: "giyeoro-local-api",
  configureServer(server: any) {
    const authOptions = {
      ...options,
      enforceLoopback: true
    };

    server.middlewares.use("/api/auth/github/callback", (request: any, response: any) => (
      handleGithubAuthCallbackRequest(request, response, authOptions)
    ));
    server.middlewares.use("/api/auth/session", (request: any, response: any) => (
      handleGithubSessionRequest(request, response, authOptions)
    ));
    server.middlewares.use("/api/auth/logout", (request: any, response: any) => (
      handleGithubLogoutRequest(request, response, authOptions)
    ));
    server.middlewares.use("/api/auth/github", (request: any, response: any) => (
      handleGithubAuthStartRequest(request, response, authOptions)
    ));
    server.middlewares.use("/api/analyze-issue", (request: any, response: any) => (
      handleAnalyzeIssueRequest(request, response, {
        ...options,
        enforceLoopback: true
      })
    ));
    server.middlewares.use("/api/github-issue", (request: any, response: any) => (
      handleGithubIssueRequest(request, response, {
        ...options,
        enforceLoopback: true
      })
    ));
    server.middlewares.use("/api/translation-status", (request: any, response: any) => (
      handleTranslationStatusRequest(request, response, {
        ...options,
        enforceLoopback: true
      })
    ));
    server.middlewares.use("/api/category-issues", (request: any, response: any) => (
      handleCategoryIssuesRequest(request, response, {
        ...options,
        enforceLoopback: true
      })
    ));
    server.middlewares.use("/api/repository-issues", (request: any, response: any) => (
      handleRepositoryIssuesRequest(request, response, {
        ...options,
        enforceLoopback: true
      })
    ));
    server.middlewares.use("/api/contribution-guide", (request: any, response: any) => (
      handleContributionGuideRequest(request, response, {
        ...options,
        enforceLoopback: true
      })
    ));
  }
});
