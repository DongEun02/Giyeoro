import assert from "node:assert/strict";
import test from "node:test";
import { createPullRequestWorkspaceItem } from "./userWorkspace.js";

const repository = {
  languageTags: ["TypeScript"],
  ownerAvatarUrl: "https://example.com/avatar.png",
  contributionGuideUrl: "https://example.com/contributing"
};

const pullRequest = {
  repository: "owner/repository",
  number: 42,
  title: "Add contribution tracking",
  body: "PR 본문입니다.",
  state: "open",
  draft: false,
  merged: false,
  author: { login: "contributor", avatarUrl: "", url: "https://github.com/contributor" },
  url: "https://github.com/owner/repository/pull/42",
  additions: 20,
  deletions: 5,
  changedFiles: 3
};

test("열린 PR은 진행 중 작업으로 만든다", () => {
  const item = createPullRequestWorkspaceItem({ pullRequest, repository });
  assert.equal(item.id, "github-pr-owner/repository-42");
  assert.equal(item.kind, "pull_request");
  assert.equal(item.status, "in_progress");
  assert.equal(item.difficulty, "검토 중");
});

test("병합된 PR은 기여 완료 작업으로 만든다", () => {
  const item = createPullRequestWorkspaceItem({
    pullRequest: {
      ...pullRequest,
      state: "closed",
      merged: true,
      mergedAt: "2026-07-24T00:00:00Z"
    },
    repository
  });
  assert.equal(item.status, "completed");
  assert.equal(item.difficulty, "병합됨");
});
