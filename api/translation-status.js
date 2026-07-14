import { handleTranslationStatusRequest } from "../server/translationStatusService.js";

export default function handler(request, response) {
  return handleTranslationStatusRequest(request, response);
}
