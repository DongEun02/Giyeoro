export type GithubDocumentReference = {
  repo: string;
  branch: string;
  path: string;
};

export type TranslationDocument = {
  id: string;
  title: string;
  source: GithubDocumentReference;
  translation: GithubDocumentReference;
};

export type TranslationProject = {
  name: string;
  description: string;
  languageTags: string[];
  techStack: string[];
  docs: TranslationDocument[];
};

export const TRANSLATION_PROJECTS: Record<string, TranslationProject> = {
  react: {
    name: "React 한국어 문서",
    description: "React 공식 영문 문서와 공식 한국어 번역 저장소를 비교합니다.",
    languageTags: ["JavaScript", "TypeScript"],
    techStack: ["React", "Documentation"],
    docs: [
      {
        id: "useid",
        title: "useId",
        source: {
          repo: "reactjs/react.dev",
          branch: "main",
          path: "src/content/reference/react/useId.md"
        },
        translation: {
          repo: "reactjs/ko.react.dev",
          branch: "main",
          path: "src/content/reference/react/useId.md"
        }
      },
      {
        id: "create-context",
        title: "createContext",
        source: {
          repo: "reactjs/react.dev",
          branch: "main",
          path: "src/content/reference/react/createContext.md"
        },
        translation: {
          repo: "reactjs/ko.react.dev",
          branch: "main",
          path: "src/content/reference/react/createContext.md"
        }
      }
    ]
  },
  mdn: {
    name: "MDN 한국어 문서",
    description: "MDN 영문 원문과 공식 translated-content의 한국어 문서를 비교합니다.",
    languageTags: ["JavaScript", "HTML/CSS"],
    techStack: ["Web API", "Documentation"],
    docs: [
      {
        id: "javascript-introduction",
        title: "JavaScript Guide: Introduction",
        source: {
          repo: "mdn/content",
          branch: "main",
          path: "files/en-us/web/javascript/guide/introduction/index.md"
        },
        translation: {
          repo: "mdn/translated-content",
          branch: "main",
          path: "files/ko/web/javascript/guide/introduction/index.md"
        }
      },
      {
        id: "using-fetch",
        title: "Using the Fetch API",
        source: {
          repo: "mdn/content",
          branch: "main",
          path: "files/en-us/web/api/fetch_api/using_fetch/index.md"
        },
        translation: {
          repo: "mdn/translated-content",
          branch: "main",
          path: "files/ko/web/api/fetch_api/using_fetch/index.md"
        }
      }
    ]
  },
  vue: {
    name: "Vue 한국어 문서",
    description: "Vue 공식 영문 문서와 공식 번역 조직의 한국어 문서를 비교합니다.",
    languageTags: ["JavaScript", "TypeScript"],
    techStack: ["Vue", "Documentation"],
    docs: [
      {
        id: "introduction",
        title: "Introduction",
        source: {
          repo: "vuejs/docs",
          branch: "main",
          path: "src/guide/introduction.md"
        },
        translation: {
          repo: "vuejs-translations/docs-ko",
          branch: "main",
          path: "src/guide/introduction.md"
        }
      },
      {
        id: "reactivity-fundamentals",
        title: "Reactivity Fundamentals",
        source: {
          repo: "vuejs/docs",
          branch: "main",
          path: "src/guide/essentials/reactivity-fundamentals.md"
        },
        translation: {
          repo: "vuejs-translations/docs-ko",
          branch: "main",
          path: "src/guide/essentials/reactivity-fundamentals.md"
        }
      }
    ]
  }
};

export const getGithubDocumentUrl = (document: GithubDocumentReference) => (
  `https://github.com/${document.repo}/blob/${document.branch}/${document.path}`
);

export const getTranslationDocument = (projectKey: string, documentId: string) => (
  TRANSLATION_PROJECTS[projectKey]?.docs.find(document => document.id === documentId) || null
);
