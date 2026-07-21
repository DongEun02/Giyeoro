import { handlePersonalizedRepositoriesRequest } from "../server/personalizedRepositoryService.js";

export default function handler(request: any, response: any) {
  return handlePersonalizedRepositoriesRequest(request, response);
}
