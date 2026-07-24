import assert from "node:assert/strict";
import test from "node:test";
import { parseGithubPullRequestUrl } from "./githubPullRequestService.js";

test("GitHub Pull Request URL을 정규화한다", () => {
  assert.deepEqual(
    parseGithubPullRequestUrl("https://github.com/toss/es-toolkit/pull/1932/?tab=files"),
    {
      owner: "toss",
      repo: "es-toolkit",
      number: 1932,
      url: "https://github.com/toss/es-toolkit/pull/1932"
    }
  );
});

test("Issue URL이나 GitHub 외 URL은 거부한다", () => {
  assert.equal(parseGithubPullRequestUrl("https://github.com/toss/es-toolkit/issues/1932"), null);
  assert.equal(parseGithubPullRequestUrl("https://example.com/toss/es-toolkit/pull/1932"), null);
  assert.equal(parseGithubPullRequestUrl("http://github.com/toss/es-toolkit/pull/1932"), null);
});
