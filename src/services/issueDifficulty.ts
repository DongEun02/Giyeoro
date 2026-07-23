const RECOMMENDATION_SOURCES = new Set([
  "github-recommendation",
  "github-repository",
  "github-category"
]);

const DIFFICULTY_LEVEL_LABELS: Record<string, string> = {
  starter: "첫 기여",
  medium: "중간",
  challenging: "도전"
};

export const hasRecommendationDifficulty = (issue: any) => (
  RECOMMENDATION_SOURCES.has(issue?.source)
  && !!DIFFICULTY_LEVEL_LABELS[issue?.difficultyLevel]
);

export const alignAnalysisDifficulty = (issue: any, analysisDifficulty: any) => {
  const recommendationLevel = DIFFICULTY_LEVEL_LABELS[issue?.difficultyLevel];
  if (!hasRecommendationDifficulty(issue) || !recommendationLevel) {
    return analysisDifficulty;
  }

  return {
    level: recommendationLevel,
    confidence: issue.difficultyConfidence || "낮음",
    rationale: issue.difficultyReason || "추천 목록에서 판정한 난이도를 상세 화면에서도 동일하게 유지합니다."
  };
};
