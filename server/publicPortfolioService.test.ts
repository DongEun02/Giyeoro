import { createHmac } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { getDatabase } from "./database.js";
import { handleWorkspaceApiRequest } from "./workspaceApiService.js";
import assert from "node:assert/strict";
import test from "node:test";
import {
  isPublicPortfolioItem,
  isValidPortfolioLogin,
  isValidPortfolioSnapshotId
} from "./publicPortfolioService.js";
import { isPortfolioStatusFilter, parsePortfolioStatuses } from "../shared/publicPortfolio.js";

test("미리보기와 공유본은 같은 다중 상태 쿼리를 해석한다", () => {
  assert.deepEqual(parsePortfolioStatuses(new URLSearchParams()), ["merged"]);
  assert.deepEqual(parsePortfolioStatuses(new URLSearchParams("status=merged&status=open&status=merged")), ["merged", "open"]);
  assert.deepEqual(parsePortfolioStatuses(new URLSearchParams("status=all")), ["all"]);
  assert.equal(parsePortfolioStatuses(new URLSearchParams("status=merged&status=invalid")), null);
  assert.equal(parsePortfolioStatuses(new URLSearchParams("status=")), null);
});

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

const authOptions = {
  clientId: "test-client",
  clientSecret: "test-secret",
  sessionSecret: "test-session-secret-with-at-least-32-characters",
  appUrl: "https://example.com",
  databaseUrl: "postgres://test:test@localhost:5432/portfolio_access_test"
};

const sessionCookie = (login = "octocat", expiresAt = Date.now() + 60_000) => {
  const payload = Buffer.from(JSON.stringify({
    id: 123, login, name: "Octocat", avatarUrl: "", profileUrl: "", expiresAt
  })).toString("base64url");
  const signature = createHmac("sha256", authOptions.sessionSecret)
    .update(`session.${payload}`).digest("base64url");
  return `giyeoro_session=${payload}.${signature}`;
};

const responseRecorder = () => ({
  statusCode: 0,
  headers: {} as Record<string, string>,
  body: "",
  setHeader(name: string, value: string) { this.headers[name] = value; },
  end(body: string) { this.body = body; }
});

test("미리보기 API는 비로그인, 만료 및 위조 세션의 접근을 차단한다", async () => {
  for (const cookie of ["", sessionCookie("octocat", Date.now() - 1_000), `${sessionCookie()}tampered`]) {
    const response = responseRecorder();
    await handleWorkspaceApiRequest({ method: "GET", url: "/api/workspace?operation=portfolio&login=octocat", headers: { cookie } }, response, authOptions);
    assert.equal(response.statusCode, 401);
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.equal(JSON.parse(response.body).items, undefined);
  }
});

test("로그인해도 다른 사용자의 미리보기 API는 직접 조회할 수 없다", async () => {
  const response = responseRecorder();
  await handleWorkspaceApiRequest({ method: "GET", url: "/api/workspace?operation=portfolio&login=another-user&status=all", headers: { cookie: sessionCookie() } }, response, authOptions);
  assert.equal(response.statusCode, 403);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(JSON.parse(response.body).items, undefined);
});

test("본인 미리보기는 대소문자와 무관하게 세션의 사용자 ID로 조회하고 캐시하지 않는다", async t => {
  const database = getDatabase(authOptions.databaseUrl);
  const queries: unknown[] = [];
  t.mock.method(database, "execute", async (query: unknown) => {
    queries.push(query);
    return { rows: [] };
  });
  const response = responseRecorder();
  await handleWorkspaceApiRequest({ method: "GET", url: "/api/workspace?operation=portfolio&login=OctoCat", headers: { cookie: sessionCookie() } }, response, authOptions);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.deepEqual(JSON.parse(response.body), { profile: { login: "octocat", name: "Octocat", avatarUrl: "", profileUrl: "" }, items: [] });
  assert.equal(queries.length, 1);
  const compiled = new PgDialect().sqlToQuery(queries[0] as SQL);
  assert.deepEqual(compiled.params, [123]);
});

test("공유 스냅샷은 로그인 없이 공유 ID로 열람할 수 있다", async t => {
  const snapshot = { profile: { login: "octocat" }, items: [] };
  t.mock.method(getDatabase(authOptions.databaseUrl), "execute", async () => ({ rows: [{ snapshot }] }));
  const response = responseRecorder();
  await handleWorkspaceApiRequest({ method: "GET", url: "/api/workspace?operation=portfolio-snapshot&id=AbCdEfGhIjKlMnOpQrStUvWx", headers: {} }, response, authOptions);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), snapshot);
});
