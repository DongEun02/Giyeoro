import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { Icons } from "../components/Icons";
import { getRepoVisual } from "../data/content";
import {
  fetchPublicPortfolio
} from "../services/publicPortfolio";
import type {
  PublicPortfolio,
  PublicPortfolioItem
} from "../services/publicPortfolio";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric"
});

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "완료일 미확인" : dateFormatter.format(date);
};

const itemTypeLabel = (item: PublicPortfolioItem) => (
  item.kind === "pull_request" ? "병합된 Pull Request" : "해결 완료한 Issue"
);

export function PortfolioPage() {
  const { login = "" } = useParams();
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setPortfolio(null);

    fetchPublicPortfolio(login, controller.signal)
      .then(setPortfolio)
      .catch(fetchError => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error
          ? fetchError.message
          : "공개 포트폴리오를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [login]);

  const stats = useMemo(() => {
    const items = portfolio?.items || [];
    return {
      total: items.length,
      pullRequests: items.filter(item => item.kind === "pull_request").length,
      issues: items.filter(item => item.kind === "issue").length,
      repositories: new Set(items.map(item => item.repo)).size
    };
  }, [portfolio]);

  if (loading) {
    return (
      <div className="portfolio-state" role="status">
        <span className="recommendation-status-spinner" aria-hidden="true" />
        <strong>기여 포트폴리오를 불러오고 있습니다.</strong>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="portfolio-state portfolio-state-error">
        <Icons.Alert className="w-5 h-5" />
        <h1>포트폴리오를 표시할 수 없습니다.</h1>
        <p>{error || "공개 포트폴리오를 찾지 못했습니다."}</p>
        <Link to="/">기여로 홈으로 이동</Link>
      </div>
    );
  }

  const { profile, items } = portfolio;

  return (
    <div className="portfolio-page animate-fade-in">
      <section className="portfolio-hero" aria-labelledby="portfolio-title">
        <div className="portfolio-profile">
          <a
            href={profile.profileUrl || undefined}
            target="_blank"
            rel="noreferrer"
            className="portfolio-avatar"
            aria-label={`${profile.login} GitHub 프로필 열기`}
          >
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} alt="" width="72" height="72" referrerPolicy="no-referrer" />
              : <BrandMark />}
          </a>
          <div>
            <span>Open Source Portfolio</span>
            <h1 id="portfolio-title">{profile.name}의 오픈소스 기여</h1>
            <a href={profile.profileUrl || undefined} target="_blank" rel="noreferrer">
              @{profile.login}
              <Icons.ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <p className="portfolio-disclosure">
          기여로에서 완료 처리한 이슈와 GitHub에서 병합이 확인된 PR만 공개합니다.
          이 페이지에서는 내용을 수정할 수 없습니다.
        </p>
      </section>

      <section className="portfolio-stats" aria-label="공개 기여 요약">
        <div><strong>{stats.total}</strong><span>전체 기여</span></div>
        <div><strong>{stats.pullRequests}</strong><span>병합된 PR</span></div>
        <div><strong>{stats.issues}</strong><span>완료 이슈</span></div>
        <div><strong>{stats.repositories}</strong><span>저장소</span></div>
      </section>

      <section className="portfolio-contributions" aria-labelledby="portfolio-contributions-title">
        <header>
          <div>
            <span>Contributions</span>
            <h2 id="portfolio-contributions-title">완료한 기여</h2>
          </div>
          <strong>{items.length}개</strong>
        </header>

        {items.length > 0 ? (
          <div className="portfolio-list">
            {items.map(item => (
              <article className="portfolio-item" key={item.id}>
                <img
                  src={item.repositoryAvatarUrl || getRepoVisual(item.repo).image}
                  alt=""
                  className="portfolio-item-logo"
                  referrerPolicy="no-referrer"
                />
                <div className="portfolio-item-main">
                  <div className="portfolio-item-eyebrow">
                    <span>{item.repo}</span>
                    <span>{itemTypeLabel(item)}</span>
                    {item.number > 0 && <span>#{item.number}</span>}
                  </div>
                  <h3>{item.title}</h3>
                  {item.summary && <p>{item.summary}</p>}
                  <div className="portfolio-item-meta">
                    <span>{formatDate(item.completedAt)} 완료</span>
                    {item.workType && <span>{item.workType}</span>}
                    {item.kind === "pull_request" && (
                      <>
                        <span>변경 파일 {item.changedFiles || 0}개</span>
                        <span className="portfolio-item-diff">
                          +{item.additions || 0} / -{item.deletions || 0}
                        </span>
                      </>
                    )}
                    {item.languageTags.slice(0, 2).map(language => (
                      <span key={language}>{language}</span>
                    ))}
                  </div>
                </div>
                {item.url && (
                  <a
                    className="portfolio-item-link"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub에서 보기
                    <Icons.ArrowRight className="w-3.5 h-3.5" />
                  </a>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="portfolio-empty">
            <Icons.GitPullRequest className="w-5 h-5" />
            <strong>아직 공개할 완료 기여가 없습니다.</strong>
            <p>완료 처리한 이슈나 GitHub에서 병합된 PR이 생기면 여기에 표시됩니다.</p>
          </div>
        )}
      </section>
    </div>
  );
}
