import { handleContributionGuideRequest } from "../server/contributionGuideService";

export default function handler(request: any, response: any) {
  return handleContributionGuideRequest(request, response);
}
