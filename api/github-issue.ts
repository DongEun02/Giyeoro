import { handleGithubIssueRequest } from "../server/issueAnalysisService";

export default function handler(request: any, response: any) {
  return handleGithubIssueRequest(request, response);
}
