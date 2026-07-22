import assert from "node:assert/strict";
import test from "node:test";
import {
  hasClaimIntent,
  isUnclaimedIssue
} from "./githubIssueAvailabilityService.js";

test("detects comments that express intent to take an issue", () => {
  const claimingComments = [
    "Can I work on this issue?",
    "I'd like to work on this.",
    "I am interested in working on this issue.",
    "Please assign this to me.",
    "I'm currently working on this issue.",
    "이 이슈 제가 맡아도 될까요?"
  ];

  claimingComments.forEach(comment => {
    assert.equal(hasClaimIntent(comment), true, comment);
  });
});

test("ignores quoted or unrelated discussion", () => {
  assert.equal(hasClaimIntent("I can reproduce this on macOS."), false);
  assert.equal(hasClaimIntent("> Can I work on this issue?\nThe quoted comment is outdated."), false);
  assert.equal(hasClaimIntent("```text\nPlease assign this to me\n```"), false);
});

test("only marks fully reviewed issues without competing work as unclaimed", () => {
  const availableIssue = {
    assignees: [],
    relatedPullRequestCount: 0,
    relatedPullRequestCountTruncated: false,
    claimCommentCount: 0,
    claimCommentReviewTruncated: false
  };

  assert.equal(isUnclaimedIssue(availableIssue), true);
  assert.equal(isUnclaimedIssue({ ...availableIssue, claimCommentCount: 1 }), false);
  assert.equal(isUnclaimedIssue({ ...availableIssue, claimCommentReviewTruncated: true }), false);
});
