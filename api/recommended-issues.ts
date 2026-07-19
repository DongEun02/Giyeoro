import { handleRecommendedIssuesRequest } from "../server/githubRecommendationsService";

export default function handler(request: any, response: any) {
  return handleRecommendedIssuesRequest(request, response);
}
