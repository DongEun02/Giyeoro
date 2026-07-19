export const TRANSLATION_LANGUAGES = [
  "All",
  "JavaScript",
  "TypeScript",
  "HTML/CSS",
  "Python",
  "Java",
  "Kotlin",
  "Swift",
  "Go",
  "Rust"
] as const;

export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number];

export type GithubDocumentReference = {
  repo: string;
  branch: string;
  path: string;
};

export type TranslationPathMapping = {
  sourceRoot: string;
  translationRoot: string;
  sourceExtensions: string[];
  translationExtension?: string;
  languageTags: string[];
};

type GithubRepositoryReference = {
  repo: string;
  branch: string;
};

export type PairedDocumentDiscovery = {
  kind: "paired-documents";
  source: GithubRepositoryReference;
  translation: GithubRepositoryReference;
  sourceScanRoot: string;
  mappings: TranslationPathMapping[];
};

export type GettextDocumentDiscovery = {
  kind: "gettext";
  source: GithubRepositoryReference;
  translation: GithubRepositoryReference;
  sourceScanRoot: string;
  mappings: TranslationPathMapping[];
};

export type TranslationProject = {
  name: string;
  description: string;
  languageTags: string[];
  techStack: string[];
  contributionGuideUrl: string;
  discovery: PairedDocumentDiscovery | GettextDocumentDiscovery;
};

export const TRANSLATION_PROJECTS: Record<string, TranslationProject> = {
  react: {
    name: "React 한국어 문서",
    description: "React 공식 영문 문서와 공식 한국어 번역 저장소의 최근 변경 문서를 비교합니다.",
    languageTags: ["JavaScript", "TypeScript"],
    techStack: ["React", "Documentation"],
    contributionGuideUrl: "https://github.com/reactjs/ko.react.dev/blob/main/CONTRIBUTING.md",
    discovery: {
      kind: "paired-documents",
      source: { repo: "reactjs/react.dev", branch: "main" },
      translation: { repo: "reactjs/ko.react.dev", branch: "main" },
      sourceScanRoot: "src/content",
      mappings: [{
        sourceRoot: "src/content",
        translationRoot: "src/content",
        sourceExtensions: [".md", ".mdx"],
        languageTags: ["JavaScript", "TypeScript"]
      }]
    }
  },
  mdn: {
    name: "MDN 한국어 문서",
    description: "MDN 영문 원문과 공식 translated-content의 최근 변경 문서를 비교합니다.",
    languageTags: ["JavaScript", "HTML/CSS"],
    techStack: ["Web API", "Documentation"],
    contributionGuideUrl: "https://github.com/mdn/translated-content/blob/main/CONTRIBUTING.md",
    discovery: {
      kind: "paired-documents",
      source: { repo: "mdn/content", branch: "main" },
      translation: { repo: "mdn/translated-content", branch: "main" },
      sourceScanRoot: "files/en-us/web",
      mappings: [
        {
          sourceRoot: "files/en-us/web/javascript",
          translationRoot: "files/ko/web/javascript",
          sourceExtensions: [".md"],
          languageTags: ["JavaScript"]
        },
        {
          sourceRoot: "files/en-us/web/api",
          translationRoot: "files/ko/web/api",
          sourceExtensions: [".md"],
          languageTags: ["JavaScript"]
        },
        {
          sourceRoot: "files/en-us/web/html",
          translationRoot: "files/ko/web/html",
          sourceExtensions: [".md"],
          languageTags: ["HTML/CSS"]
        },
        {
          sourceRoot: "files/en-us/web/css",
          translationRoot: "files/ko/web/css",
          sourceExtensions: [".md"],
          languageTags: ["HTML/CSS"]
        }
      ]
    }
  },
  vue: {
    name: "Vue 한국어 문서",
    description: "Vue 공식 영문 문서와 공식 한국어 번역 저장소의 최근 변경 문서를 비교합니다.",
    languageTags: ["JavaScript", "TypeScript"],
    techStack: ["Vue", "Documentation"],
    contributionGuideUrl: "https://github.com/vuejs-translations/docs-ko/blob/main/README.md",
    discovery: {
      kind: "paired-documents",
      source: { repo: "vuejs/docs", branch: "main" },
      translation: { repo: "vuejs-translations/docs-ko", branch: "main" },
      sourceScanRoot: "src",
      mappings: [{
        sourceRoot: "src",
        translationRoot: "src",
        sourceExtensions: [".md"],
        languageTags: ["JavaScript", "TypeScript"]
      }]
    }
  },
  python: {
    name: "Python 한국어 문서",
    description: "Python 공식 한국어 번역 저장소의 최근 튜토리얼 변경과 gettext 번역 상태를 확인합니다.",
    languageTags: ["Python"],
    techStack: ["Python", "gettext"],
    contributionGuideUrl: "https://github.com/python/python-docs-ko/blob/3.14/.pdk/guide.md",
    discovery: {
      kind: "gettext",
      source: { repo: "python/cpython", branch: "3.14" },
      translation: { repo: "python/python-docs-ko", branch: "3.14" },
      sourceScanRoot: "Doc/tutorial",
      mappings: [{
        sourceRoot: "Doc/tutorial",
        translationRoot: "tutorial",
        sourceExtensions: [".rst"],
        translationExtension: ".po",
        languageTags: ["Python"]
      }]
    }
  },
  rust: {
    name: "Rust Book 한국어 문서",
    description: "Rust 공식 Book 원문과 한국어 번역본의 최근 변경 문서를 비교합니다.",
    languageTags: ["Rust"],
    techStack: ["Rust", "mdBook"],
    contributionGuideUrl: "https://github.com/rust-kr/doc.rust-kr.org/blob/main/CONTRIBUTING.md",
    discovery: {
      kind: "paired-documents",
      source: { repo: "rust-lang/book", branch: "main" },
      translation: { repo: "rust-kr/doc.rust-kr.org", branch: "main" },
      sourceScanRoot: "src",
      mappings: [{
        sourceRoot: "src",
        translationRoot: "src",
        sourceExtensions: [".md"],
        languageTags: ["Rust"]
      }]
    }
  }
};

export const isTranslationLanguage = (value: string): value is TranslationLanguage => (
  TRANSLATION_LANGUAGES.includes(value as TranslationLanguage)
);

export const getTranslationProjectsForLanguage = (language: TranslationLanguage) => (
  Object.entries(TRANSLATION_PROJECTS).filter(([, project]) => (
    language === "All" || project.languageTags.includes(language)
  ))
);

export const getGithubDocumentUrl = (document: GithubDocumentReference) => (
  `https://github.com/${document.repo}/blob/${document.branch}/${document.path}`
);
