import { useEffect, useState } from "react";
import { Icons } from "./Icons";
import { getGithubLoginUrl } from "../services/auth";
import type { AuthUser } from "../services/auth";
import {
  fetchPersonalizedRepositories
} from "../services/personalizedRepositories";
import type {
  PersonalizedRepositoryResult
} from "../services/personalizedRepositories";

type PersonalizedRepositoryRecommendationsProps = {
  user: AuthUser | null;
  authLoading: boolean;
  onExploreRepository: (fullName: string) => void;
};

const formatLoadedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

export function PersonalizedRepositoryRecommendations({
  user,
  authLoading,
  onExploreRepository
}: PersonalizedRepositoryRecommendationsProps) {
  const [result, setResult] = useState<PersonalizedRepositoryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (!user) {
      setResult(null);
      setError("");
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");

    fetchPersonalizedRepositories({
      refresh: refreshVersion > 0,
      signal: controller.signal
    })
      .then(data => {
        if (active) setResult(data);
      })
      .catch(caughtError => {
        if (active && caughtError?.name !== "AbortError") {
          setError(caughtError instanceof Error
            ? caughtError.message
            : "맞춤 프로젝트 추천을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshVersion, user]);

  if (authLoading) {
    return (
      <div className="recommendation-status" role="status">
        <span className="recommendation-status-spinner" aria-hidden="true" />
        <div><strong>GitHub 로그인 상태를 확인하고 있습니다.</strong><span>잠시만 기다려 주세요.</span></div>
      </div>
    );
  }

  if (!user) {
    return (
      <section className="personalized-login-panel" aria-labelledby="personalized-login-heading">
        <span className="personalized-login-icon"><Icons.Github className="w-6 h-6" /></span>
        <div>
          <span>공개 데이터만 사용</span>
          <h3 id="personalized-login-heading">내 GitHub 경험에 맞는 프로젝트를 찾아보세요</h3>
          <p>공개 저장소의 언어, 최근 30일 공개 활동, 공개된 의존성 파일을 분석합니다. 비공개 저장소 권한은 요청하지 않습니다.</p>
        </div>
        <a href={getGithubLoginUrl("/issues?source=personalized")} className="personalized-login-button">
          <Icons.Github className="w-4 h-4" /> GitHub로 시작하기
        </a>
      </section>
    );
  }

  if (loading && !result) {
    return (
      <div className="recommendation-status" role="status">
        <span className="recommendation-status-spinner" aria-hidden="true" />
        <div>
          <strong>{user.login}님의 공개 GitHub 경험을 분석하고 있습니다.</strong>
          <span>언어 비중, 최근 활동, 의존성과 후보 저장소의 최신 상태를 함께 확인합니다.</span>
        </div>
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="recommendation-status recommendation-status-error" role="alert">
        <Icons.Alert className="w-4 h-4 shrink-0" />
        <div><strong>맞춤 추천을 만들지 못했습니다.</strong><span>{error}</span></div>
        <button type="button" onClick={() => setRefreshVersion(version => version + 1)}>다시 시도</button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="personalized-recommendation-flow">
      <section className="personalized-profile" aria-labelledby="personalized-profile-heading">
        <div className="personalized-profile-heading">
          <div>
            <span>공개 GitHub 활동 기준</span>
            <h3 id="personalized-profile-heading">{user.login}님의 기술 경험</h3>
            <p>최근 활동은 최대 30일 범위이며, 비공개 저장소와 비공개 활동은 포함하지 않습니다.</p>
          </div>
          <div className="recommendation-sync-summary">
            {result.loadedAt && <small>{formatLoadedAt(result.loadedAt)} 분석</small>}
            <button
              type="button"
              onClick={() => setRefreshVersion(version => version + 1)}
              disabled={loading}
            >
              {loading ? "분석 중" : "다시 분석"}
            </button>
          </div>
        </div>

        <div className="personalized-profile-stats">
          <div><strong>{result.profile.publicRepositoryCount}</strong><span>공개 저장소</span></div>
          <div><strong>{result.profile.contributionEventCount}</strong><span>최근 기여 활동</span></div>
          <div><strong>{result.profile.participatedRepositoryCount}</strong><span>참여 프로젝트</span></div>
          <div><strong>{result.profile.analyzedManifestCount}</strong><span>분석한 의존성 파일</span></div>
        </div>

        <div className="personalized-signal-groups">
          <div>
            <strong>자주 사용한 언어</strong>
            <div className="personalized-language-list">
              {result.profile.topLanguages.length > 0 ? result.profile.topLanguages.map(language => (
                <span key={language.name}>{language.name}<small>{language.percentage}%</small></span>
              )) : <em>공개 저장소에서 언어 정보를 찾지 못했습니다.</em>}
            </div>
          </div>
          <div>
            <strong>확인된 주요 의존성</strong>
            <div className="personalized-dependency-list">
              {result.profile.dependencies.length > 0 ? result.profile.dependencies.map(dependency => (
                <code key={dependency}>{dependency}</code>
              )) : <em>루트 의존성 파일에서 패키지를 찾지 못했습니다.</em>}
            </div>
          </div>
        </div>
      </section>

      <div className="personalized-result-heading">
        <div>
          <span>경험과 라이브러리 상태를 함께 반영</span>
          <h3>도전해 볼 만한 오픈소스 라이브러리</h3>
          <p>대형 프레임워크·컴파일러보다 사용 경험과 맞는 단일 목적 라이브러리를 우선합니다.</p>
        </div>
        <strong>{result.recommendations.length}개 추천</strong>
      </div>

      {error && (
        <div className="recommendation-partial-notice" role="status">
          새 분석에 실패해 직전에 확인한 추천 결과를 표시합니다. {error}
        </div>
      )}

      {result.recommendations.length > 0 ? (
        <ol className="personalized-repository-list">
          {result.recommendations.map((repository, index) => (
            <li key={repository.fullName} className="personalized-repository-card">
              <div className="personalized-repository-rank">{index + 1}</div>
              <img src={repository.ownerAvatarUrl} alt="" width="44" height="44" />
              <div className="personalized-repository-main">
                <div className="personalized-repository-title-row">
                  <div>
                    <a href={repository.url} target="_blank" rel="noreferrer">{repository.fullName}</a>
                    <span className="personalized-match-label">{repository.matchLevel} · {repository.matchScore}점</span>
                  </div>
                  <span className={`repository-health-status repository-health-${repository.activity.level}`}>
                    <i aria-hidden="true" /> {repository.activity.label}
                  </span>
                </div>
                <p>{repository.description}</p>
                <div className="personalized-repository-meta">
                  <span>{repository.language}</span>
                  <span>별 {repository.stars.toLocaleString()}개</span>
                  <span>입문 이슈 {repository.starterIssueCount}개</span>
                  <span>외부 기여 친화도 {repository.contributorFriendliness.label}</span>
                </div>
                <ul className="personalized-reasons">
                  {repository.reasons.map(reason => <li key={reason}>{reason}</li>)}
                </ul>
                <div className="personalized-repository-actions">
                  <button type="button" onClick={() => onExploreRepository(repository.fullName)}>
                    추천 이슈 보기 <Icons.ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <a href={repository.url} target="_blank" rel="noreferrer">GitHub 저장소</a>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="recommendation-status" role="status">
          <Icons.Alert className="w-4 h-4 shrink-0" />
          <div>
            <strong>현재 기준을 모두 충족하는 새 프로젝트를 찾지 못했습니다.</strong>
            <span>공개 활동이 쌓인 뒤 다시 분석하거나 단계별 추천을 이용해 보세요.</span>
          </div>
        </div>
      )}

      <div className="personalized-criteria-note">
        <Icons.Check className="w-4 h-4 shrink-0" />
        <span>공개 데이터만 분석 · 라이브러리 중심 · 최근 {result.criteria.repositoryActivityWindowDays}일 내 활동 · 라이선스와 기여 가이드 · 입문 이슈 · 외부 PR 응답 확인</span>
      </div>
    </div>
  );
}
