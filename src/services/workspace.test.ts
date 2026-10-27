import assert from "node:assert/strict";
import test from "node:test";
import { fetchIgnoredPullRequests, fetchWorkspaceItems, hideRemoteRepository, syncRemoteGithubPullRequests } from "./workspace.js";

test("GitHub 동기화가 실패해도 DB에 저장된 숨긴 프로젝트를 조회할 수 있다", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const ignored = [{ id: "pr-1", repo: "owner/project", title: "PR", url: "", ignoredAt: "2026-10-27T00:00:00Z" }];
  globalThis.fetch = async (_url, init) => init?.method === "POST"
    ? Response.json({ error: "GitHub rate limit" }, { status: 503 })
    : Response.json({ ignoredItems: ignored });

  await assert.rejects(syncRemoteGithubPullRequests(), /GitHub rate limit/);
  assert.deepEqual(await fetchIgnoredPullRequests(), ignored);
});

test("숨기기 후 작업 및 숨긴 목록을 GitHub 동기화 없이 갱신한다", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let hidden = false;
  globalThis.fetch = async (url, init) => {
    assert.notEqual(init?.method, "POST");
    if (init?.method === "DELETE") {
      hidden = true;
      return Response.json({ ok: true });
    }
    assert.equal(hidden, true);
    return String(url).includes("sync-pull-requests")
      ? Response.json({ ignoredItems: [{ repo: "owner/project" }] })
      : Response.json({ items: [] });
  };

  await hideRemoteRepository("owner/project");
  const [items, ignored] = await Promise.all([fetchWorkspaceItems(), fetchIgnoredPullRequests()]);
  assert.deepEqual(items, []);
  assert.equal(ignored[0].repo, "owner/project");
});
