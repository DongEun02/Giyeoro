import assert from "node:assert/strict";
import test from "node:test";
import { inferDifficulty } from "./githubRecommendationsService.js";

test("does not treat technical installation work as a first contribution just because docs paths appear", () => {
  const difficulty = inferDifficulty({
    labels: [],
    title: "Agent skills rely on repository-level symlinks and break when installed",
    body: "Each skill contains a docs symbolic link. The installer copies only the selected skill directory.",
    workType: "유형 미분류",
    comments: 0
  });

  assert.equal(difficulty.level, "medium");
});

test("keeps repository-owned good first issue labels as starter difficulty", () => {
  const difficulty = inferDifficulty({
    labels: [{ name: "good first issue" }],
    title: "Clarify an error message",
    body: "Update the message and its focused unit test.",
    workType: "테스트",
    comments: 0
  });

  assert.equal(difficulty.level, "starter");
  assert.equal(difficulty.source, "repository-label");
});
