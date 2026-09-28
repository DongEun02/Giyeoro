import { Icons } from "./Icons";
import { getGithubLoginUrl } from "../services/auth";

type MyPageLoginGateProps = {
  loading: boolean;
};

export function MyPageLoginGate({ loading }: MyPageLoginGateProps) {
  if (loading) {
    return (
      <div className="recommendation-status" role="status">
        <span className="recommendation-status-spinner" aria-hidden="true" />
        <div>
          <strong>GitHub 로그인 상태를 확인하고 있습니다.</strong>
          <span>확인이 끝나면 마이페이지를 보여드립니다.</span>
        </div>
      </div>
    );
  }

  return (
    <section className="mypage-login-gate animate-fade-in" aria-labelledby="mypage-login-heading">
      <span className="mypage-login-icon"><Icons.Github className="w-7 h-7" /></span>
      <div>
        <span>내 기여 포트폴리오</span>
        <h1 id="mypage-login-heading">GitHub에 흩어진 PR을 한곳에 모아보세요</h1>
        <p>로그인하면 공개된 외부 프로젝트의 PR을 자동으로 가져와 프로젝트별로 정리합니다. 비공개 저장소 권한은 요청하지 않습니다.</p>
      </div>
      <a href={getGithubLoginUrl("/mypage")} className="mypage-login-button">
        <Icons.Github className="w-4 h-4" /> GitHub로 로그인
      </a>
      <small>병합된 PR만 공개 페이지에 표시되며, 원하지 않는 프로젝트는 언제든 숨길 수 있습니다.</small>
    </section>
  );
}
