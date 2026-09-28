import assert from "node:assert/strict";
import test from "node:test";
import { isEligibleContributionPullRequest } from "./githubPullRequestSyncService.js";

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

test("공개된 외부 저장소의 작성 PR을 허용한다", () => {
  assert.equal(isEligibleContributionPullRequest(contribution(), "contributor"), true);
});

test("별 개수와 라이선스 유무로 기여를 누락하지 않는다", () => {
  assert.equal(isEligibleContributionPullRequest(contribution({
    repository: { ...contribution().repository, stargazerCount: 99 }
  }), "contributor"), true);
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
