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
        <span>로그인 전용 공간</span>
        <h1 id="mypage-login-heading">마이페이지는 GitHub 로그인 후 이용할 수 있어요</h1>
        <p>관심 있는 이슈와 기여 진행 상태를 확인하려면 GitHub 계정으로 로그인해 주세요. 비공개 저장소 권한은 요청하지 않습니다.</p>
      </div>
      <a href={getGithubLoginUrl("/mypage")} className="mypage-login-button">
        <Icons.Github className="w-4 h-4" /> GitHub로 로그인
      </a>
      <small>현재 작업 목록은 이 브라우저에 저장되며 계정 간 동기화는 아직 지원하지 않습니다.</small>
    </section>
  );
}
