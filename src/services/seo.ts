const SITE_URL = "https://giyeoro.vercel.app";

type SeoConfig = {
  title: string;
  description: string;
  canonicalPath: string;
};

const DEFAULT_SEO: SeoConfig = {
  title: "기여로 | 오픈소스 기여 PR 포트폴리오",
  description: "GitHub에 흩어진 오픈소스 Pull Request를 프로젝트별로 모아 하나의 포트폴리오 링크로 공유하세요.",
  canonicalPath: "/"
};

function getSeoConfig(pathname: string): SeoConfig {
  if (pathname.startsWith("/privacy")) {
    return {
      title: "개인정보 처리방침 | 기여로",
      description: "기여로가 개인정보를 수집하고 이용하며 보호하는 방법을 확인하세요.",
      canonicalPath: "/privacy"
    };
  }

  if (pathname.startsWith("/about")) {
    return {
      title: "서비스 소개 | 기여로",
      description: "기여로가 첫 오픈소스 기여를 찾고, 이해하고, 준비하는 과정을 어떻게 돕는지 알아보세요.",
      canonicalPath: "/about"
    };
  }

  if (pathname.startsWith("/issues") || pathname.startsWith("/translations")) {
    return {
      title: "첫 기여 찾기 | 기여로",
      description: "관심 분야와 난이도에 맞는 오픈소스 프로젝트와 기여하기 좋은 GitHub 이슈를 찾아보세요.",
      canonicalPath: "/issues"
    };
  }

  if (pathname.startsWith("/guides")) {
    return {
      title: "오픈소스 기여 가이드 | 기여로",
      description: "저장소별 기여 가이드를 확인하고 첫 오픈소스 기여를 단계별로 준비하세요.",
      canonicalPath: "/guides"
    };
  }

  if (pathname.startsWith("/mypage")) {
    return {
      title: "내 오픈소스 기여 | 기여로",
      description: "GitHub Pull Request를 프로젝트별로 모으고 공개할 기여를 관리하세요.",
      canonicalPath: "/mypage"
    };
  }

  if (pathname.startsWith("/portfolio")) {
    return {
      title: "오픈소스 기여 포트폴리오 | 기여로",
      description: "GitHub에서 병합된 오픈소스 Pull Request를 프로젝트별로 확인하세요.",
      canonicalPath: pathname
    };
  }

  return DEFAULT_SEO;
}

function setMetaContent(selector: string, content: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", content);
}

export function updateSeoMetadata(pathname: string) {
  const config = getSeoConfig(pathname);
  const canonicalUrl = `${SITE_URL}${config.canonicalPath}`;

  document.title = config.title;
  setMetaContent('meta[name="description"]', config.description);
  setMetaContent('meta[property="og:title"]', config.title);
  setMetaContent('meta[property="og:description"]', config.description);
  setMetaContent('meta[property="og:url"]', canonicalUrl);
  setMetaContent('meta[name="twitter:title"]', config.title);
  setMetaContent('meta[name="twitter:description"]', config.description);
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", canonicalUrl);
}
