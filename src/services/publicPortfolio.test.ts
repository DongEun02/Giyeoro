import assert from "node:assert/strict";
import test from "node:test";
import { buildPortfolioPath, readPortfolioStatuses, savePortfolioStatuses } from "./portfolioPreferences.js";
import { createPublicPortfolioSnapshot, fetchPublicPortfolio } from "./publicPortfolio.js";
import { parsePortfolioStatuses } from "../../shared/publicPortfolio.js";

test("포트폴리오 선택은 계정별로 저장되며 잘못된 저장값은 기본값으로 돌아간다", t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const saved = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value)
  } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });
  savePortfolioStatuses("Octocat", ["merged", "open"]);
  assert.deepEqual(readPortfolioStatuses("octocat"), ["merged", "open"]);
  assert.deepEqual(readPortfolioStatuses("another-user"), ["merged"]);
  saved.set("giyeoro:portfolio-statuses:octocat", '["invalid"]');
  assert.deepEqual(readPortfolioStatuses("octocat"), ["merged"]);
});

test("미리보기 URL과 두 API가 동일한 PR 상태 조합을 전달한다", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls: URL[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push(new URL(String(url), "https://example.com"));
    return init?.method === "POST"
      ? Response.json({ snapshotId: "example-snapshot" })
      : Response.json({ profile: { login: "octocat" }, items: [] });
  };
  const statuses = ["merged", "closed"] as ("merged" | "closed")[];
  const path = buildPortfolioPath("octocat", statuses);
  const previewStatuses = parsePortfolioStatuses(new URL(path, "https://example.com").searchParams)!;
  await fetchPublicPortfolio("octocat", undefined, previewStatuses);
  await createPublicPortfolioSnapshot(statuses);
  assert.deepEqual(calls[0].searchParams.getAll("status"), statuses);
  assert.deepEqual(calls[1].searchParams.getAll("status"), statuses);
});
