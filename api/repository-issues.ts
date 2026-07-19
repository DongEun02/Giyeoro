import { handleRepositoryIssuesRequest } from "../server/githubRecommendationsService";

export default function handler(request: any, response: any) {
  return handleRepositoryIssuesRequest(request, response);
}
