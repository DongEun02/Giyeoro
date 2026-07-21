import type { WorkspaceItem } from "./userWorkspace";

type WorkspaceItemsResponse = {
  items: WorkspaceItem[];
};

const parseError = async (response: Response, fallback: string) => {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || fallback;
};

const request = async <T>(path: string, init: RequestInit, fallback: string): Promise<T> => {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    }
  });

  if (!response.ok) throw new Error(await parseError(response, fallback));
  return response.json() as Promise<T>;
};

export const syncWorkspaceItems = async (items: WorkspaceItem[], signal?: AbortSignal) => {
  const body = await request<WorkspaceItemsResponse>("/api/workspace", {
    method: "POST",
    body: JSON.stringify({ items }),
    signal
  }, "작업 목록을 불러오지 못했습니다.");
  return body.items;
};

export const upsertWorkspaceItem = async (item: WorkspaceItem) => {
  await request<{ item: WorkspaceItem }>("/api/workspace", {
    method: "PUT",
    body: JSON.stringify({ item })
  }, "작업을 저장하지 못했습니다.");
};

export const updateRemoteWorkspaceStatus = async (id: string, status: string) => {
  const body = await request<{ ok: true; updatedAt: string }>("/api/workspace", {
    method: "PATCH",
    body: JSON.stringify({ id, status })
  }, "작업 상태를 변경하지 못했습니다.");
  return body.updatedAt;
};

export const deleteRemoteWorkspaceItem = async (id: string) => {
  await request<{ ok: true }>(`/api/workspace?id=${encodeURIComponent(id)}`, {
    method: "DELETE"
  }, "작업을 삭제하지 못했습니다.");
};
