import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchAuthoredPullRequests,
  isEligibleContributionPullRequest,
  selectPullRequestsToSync
} from "./githubPullRequestSyncService.js";

const contribution = (overrides: Record<string, unknown> = {}) => ({
  number: 12,
  state: "OPEN" as const,
  merged: false,
  author: { login: "contributor" },
  repository: {
    nameWithOwner: "opensource/library",
    stargazerCount: 100,
    isPrivate: false,
    isArchived: false,
    isDisabled: false,
    licenseInfo: { spdxId: "MIT" },
    owner: { login: "opensource" }
  },
  ...overrides
});

test("스타 50개 이상인 공개 외부 저장소의 작성 PR을 허용한다", () => {
  assert.equal(isEligibleContributionPullRequest(contribution(), "contributor"), true);
});

test("스타 50개 미만은 제외하고 라이선스 유무는 제한하지 않는다", () => {
  assert.equal(isEligibleContributionPullRequest(contribution({
    repository: { ...contribution().repository, stargazerCount: 49 }
  }), "contributor"), false);
  assert.equal(isEligibleContributionPullRequest(contribution({
    repository: { ...contribution().repository, licenseInfo: null }
  }), "contributor"), true);
});

test("자기 저장소와 닫혔지만 병합되지 않은 PR은 제외한다", () => {
  assert.equal(isEligibleContributionPullRequest(contribution({
    repository: { ...contribution().repository, owner: { login: "contributor" } }
  }), "contributor"), false);
  assert.equal(isEligibleContributionPullRequest(contribution({
    state: "CLOSED",
    merged: false
  }), "contributor"), false);
});

test("병합된 PR은 허용한다", () => {
  assert.equal(isEligibleContributionPullRequest(contribution({
    state: "MERGED",
    merged: true
  }), "contributor"), true);
});

test("저장된 PR이 병합 없이 닫히면 Closed로 갱신하고 새 닫힌 PR은 가져오지 않는다", () => {
  const closed = contribution({ state: "CLOSED", merged: false, closedAt: "2026-10-21T00:00:00Z" });
  const existingId = "github-pr-opensource/library-12";
  assert.deepEqual(selectPullRequestsToSync([closed], "contributor", new Set()), []);

  const [item] = selectPullRequestsToSync([closed], "contributor", new Set([existingId]));
  assert.equal(item.id, existingId);
  assert.equal(item.status, "completed");
  assert.equal(item.difficulty, "닫힘");
  assert.equal(item.data.state, "closed");
  assert.equal(item.data.merged, false);
});

test("GitHub가 빈 응답을 반환하면 다시 요청한다", async t => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) return new Response("", { status: 200 });
    return Response.json({
      data: {
        search: {
          nodes: [contribution()],
          pageInfo: { hasNextPage: false, endCursor: null }
        }
      }
    });
  };

  const result = await fetchAuthoredPullRequests({
    id: 1,
    login: "contributor",
    name: "Contributor",
    avatarUrl: "",
    profileUrl: ""
  }, "token");

  assert.equal(requestCount, 2);
  assert.equal(result.nodes.length, 1);
});
