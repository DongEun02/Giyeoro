export type ContributionCategoryId =
  | "documentation"
  | "tests"
  | "types"
  | "bugfix"
  | "feature";

export type ContributionCategory = {
  id: ContributionCategoryId;
  stage: 1 | 2 | 3;
  title: string;
  stageLabel: string;
  description: string;
  repositoryNames: readonly string[];
};

export const CONTRIBUTION_CATEGORIES: readonly ContributionCategory[] = [
  {
    id: "documentation",
    stage: 1,
    title: "문서 번역",
    stageLabel: "프로젝트 익히기",
    description: "작은 문서 변경으로 기여 흐름과 협업 방식을 먼저 경험합니다.",
    repositoryNames: [
      "mdn/translated-content",
      "reactjs/ko.react.dev",
      "vuejs-translations/docs-ko",
      "python/python-docs-ko",
      "rust-kr/doc.rust-kr.org"
    ]
  },
  {
    id: "tests",
    stage: 2,
    title: "테스트 코드",
    stageLabel: "동작 이해하기",
    description: "기존 동작을 테스트로 표현하며 코드 구조와 실행 흐름을 익힙니다.",
    repositoryNames: [
      "vitest-dev/vitest",
      "pytest-dev/pytest",
      "junit-team/junit5",
      "kotest/kotest",
      "testing-library/react-testing-library"
    ]
  },
  {
    id: "types",
    stage: 2,
    title: "타입 개선",
    stageLabel: "구조 이해하기",
    description: "타입 정의와 경계 조건을 다듬으며 코드의 의도를 파악합니다.",
    repositoryNames: [
      "DefinitelyTyped/DefinitelyTyped",
      "microsoft/TypeScript",
      "typescript-eslint/typescript-eslint",
      "python/typeshed",
      "Kotlin/kotlinx.serialization"
    ]
  },
  {
    id: "bugfix",
    stage: 3,
    title: "버그 수정",
    stageLabel: "문제 해결하기",
    description: "재현 가능한 문제의 원인을 찾고 기존 동작을 안전하게 고칩니다.",
    repositoryNames: [
      "vitejs/vite",
      "spring-projects/spring-boot",
      "JetBrains/kotlin",
      "facebook/react",
      "nodejs/node"
    ]
  },
  {
    id: "feature",
    stage: 3,
    title: "기능 추가",
    stageLabel: "설계에 참여하기",
    description: "요구사항과 기존 구조를 함께 고려해 새로운 동작을 제안하고 구현합니다.",
    repositoryNames: [
      "vercel/next.js",
      "spring-projects/spring-boot",
      "android/nowinandroid",
      "vitejs/vite",
      "Kotlin/kotlinx.coroutines"
    ]
  }
] as const;

export const getContributionCategory = (categoryId: string) => (
  CONTRIBUTION_CATEGORIES.find(category => category.id === categoryId) || null
);

export const isContributionCategoryId = (value: string): value is ContributionCategoryId => (
  CONTRIBUTION_CATEGORIES.some(category => category.id === value)
);
