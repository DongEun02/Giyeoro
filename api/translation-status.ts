import { handleTranslationStatusRequest } from "../server/translationStatusService";

export default function handler(request: any, response: any) {
  return handleTranslationStatusRequest(request, response);
}
