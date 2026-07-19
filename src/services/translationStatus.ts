const CACHE_KEY = "oss:translation-status:v1";
const CACHE_TTL_MS = 30 * 60 * 1000;

const readCache = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!cached?.savedAt || !cached?.value) return null;
    if (Date.now() - cached.savedAt > CACHE_TTL_MS) return null;
    return cached.value;
  } catch {
    return null;
  }
};

const writeCache = (value: any) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
};

export const clearTranslationStatusCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore storage access failures and continue with a network refresh.
  }
};

export const fetchTranslationStatuses = async (
  { force = false, signal }: { force?: boolean; signal?: AbortSignal } = {}
) => {
  if (!force) {
    const cached = readCache();
    if (cached) return { ...cached, browserCached: true };
  }

  const response = await fetch(`/api/translation-status${force ? "?refresh=1" : ""}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "번역 상태를 확인하지 못했습니다.");

  writeCache(data);
  return data;
};

export const indexTranslationStatuses = (result: any) => {
  const index: Record<string, any> = {};
  (result?.projects || []).forEach((project: any) => {
    (project.docs || []).forEach((document: any) => {
      index[`translation-${project.key}-${document.id}`] = document;
    });
  });
  return index;
};
