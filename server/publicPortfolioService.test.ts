import assert from "node:assert/strict";
import test from "node:test";
import {
  isPublicPortfolioItem,
  isValidPortfolioLogin
} from "./publicPortfolioService.js";

test("공개 포트폴리오 GitHub 사용자 이름을 검증한다", () => {
  assert.equal(isValidPortfolioLogin("octocat"), true);
  assert.equal(isValidPortfolioLogin("hello-world-7"), true);
  assert.equal(isValidPortfolioLogin("bad/login"), false);
  assert.equal(isValidPortfolioLogin(""), false);
});

test("완료 처리한 이슈만 공개한다", () => {
  assert.equal(isPublicPortfolioItem({ kind: "issue", status: "completed", data: {} }), true);
  assert.equal(isPublicPortfolioItem({ kind: "issue", status: "in_progress", data: {} }), false);
});

test("GitHub에서 병합된 완료 PR만 공개한다", () => {
  assert.equal(isPublicPortfolioItem({
    kind: "pull_request",
    status: "completed",
    data: { merged: true }
  }), true);
  assert.equal(isPublicPortfolioItem({
    kind: "pull_request",
    status: "completed",
    data: { merged: false }
  }), false);
  assert.equal(isPublicPortfolioItem({
    kind: "pull_request",
    status: "in_progress",
    data: { merged: true }
  }), false);
});

test("번역 작업은 완료 상태여도 공개하지 않는다", () => {
  assert.equal(isPublicPortfolioItem({ kind: "translation", status: "completed", data: {} }), false);
});
