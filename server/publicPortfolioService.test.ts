import assert from "node:assert/strict";
import test from "node:test";
import {
  isPublicPortfolioItem,
  isValidPortfolioLogin,
  isValidPortfolioSnapshotId
} from "./publicPortfolioService.js";
import { isPortfolioStatusFilter } from "../shared/publicPortfolio.js";

test("공유할 PR 상태는 지정된 네 가지 값만 허용한다", () => {
  for (const state of ["all", "merged", "open", "closed"]) assert.equal(isPortfolioStatusFilter(state), true);
  for (const state of ["", "invalid", null]) assert.equal(isPortfolioStatusFilter(state), false);
});

test("공유본에는 사용자가 선택한 상태의 PR만 포함한다", () => {
  const candidates = [
    { kind: "pull_request", status: "completed", data: { merged: true, state: "closed", repositoryStars: 50 } },
    { kind: "pull_request", status: "in_progress", data: { merged: false, state: "open", repositoryStars: 50 } },
    { kind: "pull_request", status: "completed", data: { merged: false, state: "closed", repositoryStars: 50 } }
  ] as const;
  for (const [index, filter] of (["merged", "open", "closed"] as const).entries()) {
    assert.deepEqual(candidates.filter(item => isPublicPortfolioItem(item, filter)), [candidates[index]]);
  }
  assert.equal(candidates.filter(item => isPublicPortfolioItem(item, "all")).length, 3);
  assert.deepEqual(candidates.filter(item => isPublicPortfolioItem(item, ["merged", "open"])), [candidates[0], candidates[1]]);
  assert.deepEqual(candidates.filter(item => isPublicPortfolioItem(item, ["open", "closed"])), [candidates[1], candidates[2]]);
  assert.equal(candidates.filter(item => isPublicPortfolioItem(item, [])).length, 0);
  assert.equal(isPublicPortfolioItem({ ...candidates[1], data: { state: "open", repositoryStars: 49 } }, "all"), false);
  assert.equal(isPublicPortfolioItem({ ...candidates[1], status: "interested" }, "all"), false);
});

test("공개 포트폴리오 GitHub 사용자 이름을 검증한다", () => {
  assert.equal(isValidPortfolioLogin("octocat"), true);
  assert.equal(isValidPortfolioLogin("hello-world-7"), true);
  assert.equal(isValidPortfolioLogin("bad/login"), false);
  assert.equal(isValidPortfolioLogin(""), false);
});

test("공유 스냅샷 ID를 검증한다", () => {
  assert.equal(isValidPortfolioSnapshotId("AbCdEfGhIjKlMnOpQrStUvWx"), true);
  assert.equal(isValidPortfolioSnapshotId("bad/id"), false);
  assert.equal(isValidPortfolioSnapshotId("too-short"), false);
});

test("이슈는 완료 상태여도 공개하지 않는다", () => {
  assert.equal(isPublicPortfolioItem({ kind: "issue", status: "completed", data: {} }), false);
  assert.equal(isPublicPortfolioItem({ kind: "issue", status: "in_progress", data: {} }), false);
});

test("GitHub에서 병합된 완료 PR만 공개한다", () => {
  assert.equal(isPublicPortfolioItem({
    kind: "pull_request",
    status: "completed",
    data: { merged: true, repositoryStars: 50 }
  }), true);
  assert.equal(isPublicPortfolioItem({
    kind: "pull_request",
    status: "completed",
    data: { merged: false }
  }), false);
  assert.equal(isPublicPortfolioItem({
    kind: "pull_request",
    status: "in_progress",
    data: { merged: true, repositoryStars: 50 }
  }), false);
});

test("스타 50개 미만 저장소의 PR은 공개하지 않는다", () => {
  assert.equal(isPublicPortfolioItem({
    kind: "pull_request",
    status: "completed",
    data: { merged: true, repositoryStars: 49 }
  }), false);
});

test("번역 작업은 완료 상태여도 공개하지 않는다", () => {
  assert.equal(isPublicPortfolioItem({ kind: "translation", status: "completed", data: {} }), false);
});
