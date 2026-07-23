import assert from "node:assert/strict";
import test from "node:test";
import { alignAnalysisDifficulty } from "./issueDifficulty.js";

const aiMedium = {
  level: "중간",
  confidence: "중간",
  rationale: "여러 파일의 구조를 함께 이해해야 합니다."
};

test("keeps starter difficulty consistent between a recommendation card and its detail page", () => {
  const difficulty = alignAnalysisDifficulty({
    source: "github-category",
    difficultyLevel: "starter",
    difficultyConfidence: "낮음",
    difficultyReason: "작은 변경 범위로 추정했습니다."
  }, aiMedium);

  assert.deepEqual(difficulty, {
    level: "첫 기여",
    confidence: "낮음",
    rationale: "작은 변경 범위로 추정했습니다."
  });
});

test("keeps medium recommendations labeled medium on the detail page", () => {
  const difficulty = alignAnalysisDifficulty({
    source: "github-repository",
    difficultyLevel: "medium",
    difficultyConfidence: "중간",
    difficultyReason: "저장소 구조 확인이 필요합니다."
  }, { level: "첫 기여", confidence: "낮음", rationale: "작은 변경입니다." });

  assert.equal(difficulty.level, "중간");
  assert.equal(difficulty.rationale, "저장소 구조 확인이 필요합니다.");
});

test("uses AI difficulty for issues opened directly by URL", () => {
  assert.equal(alignAnalysisDifficulty({
    source: "github-import",
    difficultyLevel: "unlabeled"
  }, aiMedium), aiMedium);
});
