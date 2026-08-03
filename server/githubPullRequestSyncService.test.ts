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

test("별 100개 이상인 공개 오픈소스 저장소의 작성 PR을 허용한다", () => {
  assert.equal(isEligibleContributionPullRequest(contribution(), "contributor"), true);
});

test("별 100개 미만이거나 라이선스가 없으면 제외한다", () => {
  assert.equal(isEligibleContributionPullRequest(contribution({
    repository: { ...contribution().repository, stargazerCount: 99 }
  }), "contributor"), false);
  assert.equal(isEligibleContributionPullRequest(contribution({
    repository: { ...contribution().repository, licenseInfo: null }
  }), "contributor"), false);
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
