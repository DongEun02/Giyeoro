import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { Icons } from "../components/Icons";
import { getRepoVisual } from "../data/content";
import { fetchPublicPortfolio } from "../services/publicPortfolio";
import type { PublicPortfolio, PublicPortfolioItem } from "../services/publicPortfolio";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" });

const groupByRepository = (items: PublicPortfolioItem[]) => {
  const groups = new Map<string, PublicPortfolioItem[]>();
  items.forEach(item => {
    const current = groups.get(item.repo) || [];
    current.push(item);
    groups.set(item.repo, current);
  });
  return Array.from(groups, ([repo, contributions]) => {
    const sorted = [...contributions].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    return {
      repo,
      items: sorted,
      additions: sorted.reduce((sum, item) => sum + (item.additions || 0), 0),
      deletions: sorted.reduce((sum, item) => sum + (item.deletions || 0), 0),
      changedFiles: sorted.reduce((sum, item) => sum + (item.changedFiles || 0), 0),
      avatarUrl: sorted[0]?.repositoryAvatarUrl || "",
      languages: Array.from(new Set(sorted.flatMap(item => item.languageTags))).slice(0, 3),
      latestAt: sorted[0]?.completedAt || ""
    };
  }).sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
};

export function PortfolioPage() {
  const { login = "" } = useParams();
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setPortfolio(null);
    fetchPublicPortfolio(login, controller.signal)
      .then(setPortfolio)
      .catch(fetchError => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "공개 포트폴리오를 불러오지 못했습니다.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [login]);

  const repositories = useMemo(() => groupByRepository(portfolio?.items || []), [portfolio]);

  if (loading) return <div className="portfolio-state" role="status"><span className="recommendation-status-spinner" aria-hidden="true" /><strong>기여 포트폴리오를 불러오고 있습니다.</strong></div>;
  if (error || !portfolio) return <div className="portfolio-state portfolio-state-error"><Icons.Alert className="w-5 h-5" /><h1>포트폴리오를 표시할 수 없습니다.</h1><p>{error || "공개 포트폴리오를 찾지 못했습니다."}</p><Link to="/">기여로 홈으로 이동</Link></div>;

  const { profile, items } = portfolio;
  const totalAdditions = items.reduce((sum, item) => sum + (item.additions || 0), 0);

  const toggleRepository = (repo: string) => setExpandedRepos(current => {
    const next = new Set(current);
    if (next.has(repo)) next.delete(repo); else next.add(repo);
    return next;
  });

  return (
    <div className="portfolio-page portfolio-project-page animate-fade-in">
      <section className="portfolio-hero" aria-labelledby="portfolio-title">
        <div className="portfolio-profile">
          <a href={profile.profileUrl || undefined} target="_blank" rel="noreferrer" className="portfolio-avatar" aria-label={`${profile.login} GitHub 프로필 열기`}>
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" width="72" height="72" referrerPolicy="no-referrer" /> : <BrandMark />}
          </a>
          <div><span>Open Source Contributions</span><h1 id="portfolio-title">{profile.name}의 오픈소스 기여</h1><a href={profile.profileUrl || undefined} target="_blank" rel="noreferrer">@{profile.login}<Icons.ArrowRight className="w-3.5 h-3.5" /></a></div>
        </div>
        <p className="portfolio-disclosure">GitHub에서 병합이 확인된 Pull Request를 프로젝트별로 정리했습니다.</p>
      </section>

      <section className="portfolio-stats" aria-label="공개 기여 요약">
        <div><strong>{repositories.length}</strong><span>기여 프로젝트</span></div>
        <div><strong>{items.length}</strong><span>병합된 PR</span></div>
        <div><strong>+{totalAdditions.toLocaleString()}</strong><span>추가한 코드</span></div>
        <div><strong>{new Set(items.flatMap(item => item.languageTags)).size}</strong><span>사용 언어</span></div>
      </section>

      <section className="portfolio-contributions" aria-labelledby="portfolio-contributions-title">
        <header><div><span>Projects</span><h2 id="portfolio-contributions-title">프로젝트별 기여</h2></div><strong>{repositories.length}개</strong></header>
        {repositories.length > 0 ? <div className="portfolio-project-list">{repositories.map(project => {
          const expanded = expandedRepos.has(project.repo);
          const visibleItems = expanded ? project.items : project.items.slice(0, 3);
          return <article className="portfolio-project-card" key={project.repo}>
            <header><img src={project.avatarUrl || getRepoVisual(project.repo).image} alt="" referrerPolicy="no-referrer" /><div><span>{project.languages.join(" · ") || "Open Source"}</span><h3>{project.repo}</h3><p>{project.items.length}개의 PR · 변경 파일 {project.changedFiles}개 · 최근 {dateFormatter.format(new Date(project.latestAt))}</p></div><div className="portfolio-project-diff"><strong>+{project.additions.toLocaleString()}</strong><span>-{project.deletions.toLocaleString()}</span></div></header>
            <div className="portfolio-project-prs">{visibleItems.map(item => <a href={item.url || undefined} target="_blank" rel="noreferrer" key={item.id}><span>Merged</span><strong>{item.title}</strong><small>#{item.number} · {dateFormatter.format(new Date(item.completedAt))}</small><Icons.ArrowRight className="w-4 h-4" /></a>)}</div>
            {project.items.length > 3 ? <button type="button" onClick={() => toggleRepository(project.repo)}>{expanded ? "대표 PR만 보기" : `전체 PR ${project.items.length}개 보기`}</button> : null}
          </article>;
        })}</div> : <div className="portfolio-empty"><Icons.GitPullRequest className="w-5 h-5" /><strong>아직 공개할 병합 PR이 없습니다.</strong><p>병합된 오픈소스 PR이 생기면 프로젝트별로 표시됩니다.</p></div>}
      </section>
    </div>
  );
}
