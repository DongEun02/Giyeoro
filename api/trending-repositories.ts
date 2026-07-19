import { handleTrendingRepositoriesRequest } from "../server/trendingRepositoriesService";

export default function handler(request: any, response: any) {
  return handleTrendingRepositoriesRequest(request, response);
}
