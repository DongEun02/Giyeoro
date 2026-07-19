import { handleAnalyzeIssueRequest } from "../server/issueAnalysisService";

export default function handler(request: any, response: any) {
  return handleAnalyzeIssueRequest(request, response);
}
