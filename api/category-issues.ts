import { handleCategoryIssuesRequest } from "../server/githubRecommendationsService.js";

export default function handler(request: any, response: any) {
  return handleCategoryIssuesRequest(request, response);
}
