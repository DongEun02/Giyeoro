export type ContributionCategoryId =
  | "documentation"
  | "tests"
  | "types"
  | "bugfix"
  | "feature";

export type ContributionLanguage =
  | "JavaScript"
  | "TypeScript"
  | "HTML/CSS"
  | "Python"
  | "Java"
  | "Kotlin"
  | "Swift"
  | "Go"
  | "Rust";

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
    description: "프로젝트의 기존 동작을 작은 테스트로 표현하며 실행 흐름을 익힙니다.",
    repositoryNames: [
      "testing-library/dom-testing-library",
      "mockito/mockito",
      "stretchr/testify",
      "HypothesisWorks/hypothesis",
      "assertj/assertj"
    ]
  },
  {
    id: "types",
    stage: 2,
    title: "타입 개선",
    stageLabel: "구조 이해하기",
    description: "타입 정의와 경계 조건을 다듬으며 코드의 의도를 파악합니다.",
    repositoryNames: [
      "colinhacks/zod",
      "axios/axios",
      "TanStack/query",
      "testing-library/react-testing-library",
      "marshmallow-code/marshmallow",
      "python-attrs/attrs"
    ]
  },
  {
    id: "bugfix",
    stage: 3,
    title: "버그 수정",
    stageLabel: "문제 해결하기",
    description: "프로젝트 규모와 관계없이 재현 가능하고 범위가 분명한 문제를 안전하게 고칩니다.",
    repositoryNames: [
      "immerjs/immer",
      "go-playground/validator",
      "google/gson",
      "square/moshi",
      "coil-kt/coil"
    ]
  },
  {
    id: "feature",
    stage: 3,
    title: "기능 추가",
    stageLabel: "설계에 참여하기",
    description: "요구사항과 기존 구조를 살펴 범위가 분명한 작은 기능을 구현합니다.",
    repositoryNames: [
      "floating-ui/floating-ui",
      "pallets/click",
      "marshmallow-code/marshmallow",
      "faker-js/faker",
      "go-playground/validator"
    ]
  }
] as const;

const DOCUMENTATION_LANGUAGES: readonly ContributionLanguage[] = [
  "JavaScript",
  "TypeScript",
  "HTML/CSS",
  "Python",
  "Java",
  "Kotlin",
  "Swift",
  "Go",
  "Rust"
];

const REPOSITORY_LANGUAGES: Readonly<Record<string, readonly ContributionLanguage[]>> = {
  "mdn/translated-content": ["JavaScript", "HTML/CSS"],
  "reactjs/ko.react.dev": ["JavaScript", "TypeScript"],
  "vuejs-translations/docs-ko": ["JavaScript", "TypeScript"],
  "python/python-docs-ko": ["Python"],
  "rust-kr/doc.rust-kr.org": ["Rust"],
  "testing-library/dom-testing-library": ["JavaScript"],
  "mockito/mockito": ["Java"],
  "stretchr/testify": ["Go"],
  "HypothesisWorks/hypothesis": ["Python"],
  "assertj/assertj": ["Java"],
  "colinhacks/zod": ["TypeScript"],
  "axios/axios": ["JavaScript"],
  "TanStack/query": ["TypeScript"],
  "testing-library/react-testing-library": ["TypeScript"],
  "marshmallow-code/marshmallow": ["Python"],
  "python-attrs/attrs": ["Python"],
  "immerjs/immer": ["JavaScript"],
  "go-playground/validator": ["Go"],
  "google/gson": ["Java"],
  "square/moshi": ["Kotlin"],
  "coil-kt/coil": ["Kotlin"],
  "floating-ui/floating-ui": ["TypeScript"],
  "pallets/click": ["Python"],
  "faker-js/faker": ["TypeScript"]
};

export const isContributionLanguage = (value: string): value is ContributionLanguage => (
  DOCUMENTATION_LANGUAGES.includes(value as ContributionLanguage)
);

export const getContributionCategoryLanguages = (
  categoryId: ContributionCategoryId
): readonly ContributionLanguage[] => {
  return getContributionCategory(categoryId) ? DOCUMENTATION_LANGUAGES : [];
};

export const getContributionCategoryRepositories = (
  categoryId: ContributionCategoryId,
  language: ContributionLanguage
) => {
  const category = getContributionCategory(categoryId);
  if (!category) return [];
  return category.repositoryNames.filter(name => (
    (REPOSITORY_LANGUAGES[name] || []).includes(language)
  ));
};

export const getContributionCategory = (categoryId: string) => (
  CONTRIBUTION_CATEGORIES.find(category => category.id === categoryId) || null
);

export const isContributionCategoryId = (value: string): value is ContributionCategoryId => (
  CONTRIBUTION_CATEGORIES.some(category => category.id === value)
);
