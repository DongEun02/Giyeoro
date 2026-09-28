import { Link, useNavigate } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { Icons } from "../components/Icons";

const SAMPLE_PROJECTS = [
  { repo: "vercel/next.js", count: 18, additions: "2,840", language: "TypeScript", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/nextjs/nextjs-original.svg" },
  { repo: "facebook/react", count: 7, additions: "1,120", language: "JavaScript", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/react/react-original.svg" },
  { repo: "rust-lang/rust", count: 4, additions: "680", language: "Rust", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/rust/rust-original.svg" }
];

export function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="contribution-landing animate-fade-in">
      <header className="contribution-landing-nav">
        <button type="button" onClick={() => navigate("/")} aria-label="기여로 홈"><BrandMark /><strong>기여로</strong></button>
      </header>
      <main>
        <section className="contribution-landing-hero">
          <span>GitHub Contribution Portfolio</span>
          <h1>흩어진 오픈소스 기여를<br /><strong>하나의 링크로.</strong></h1>
          <p>내가 만든 Pull Request를 자동으로 모아 프로젝트별로 정리하고,<br />보여주고 싶은 기여만 골라 간편하게 공유하세요.</p>
          <button type="button" onClick={() => navigate("/mypage")}><Icons.Github className="w-5 h-5" />GitHub로 시작하기</button>
          <small>공개 저장소의 PR만 사용하며 비공개 저장소 권한은 요청하지 않습니다.</small>
        </section>
        <section className="contribution-landing-preview" aria-label="프로젝트별 기여 포트폴리오 예시">
          <div className="contribution-preview-header"><div><span>Open Source Contributions</span><h2>프로젝트별 기여</h2></div><strong>29 Merged PRs</strong></div>
          <div className="contribution-preview-list">{SAMPLE_PROJECTS.map(project => <article key={project.repo}><img className="contribution-preview-icon" src={project.icon} alt={`${project.repo} 프로젝트 아이콘`} width="44" height="44" referrerPolicy="no-referrer" /><div><span>{project.language}</span><h3>{project.repo}</h3><p>병합된 Pull Request {project.count}개</p></div><strong>+{project.additions}</strong><Icons.ArrowRight className="w-4 h-4" /></article>)}</div>
        </section>
      </main>
      <footer><span>© 2026 기여로 · 오픈소스 기여를 기록하는 가장 간단한 방법</span><nav aria-label="하단 메뉴"><Link to="/privacy">개인정보 처리방침</Link><a href="mailto:imde0205@gmail.com">문의하기</a></nav></footer>
    </div>
  );
}
