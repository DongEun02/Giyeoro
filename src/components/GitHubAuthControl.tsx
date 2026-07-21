import { Icons } from "./Icons";
import type { AuthUser } from "../services/auth";

type GitHubAuthControlProps = {
  user: AuthUser | null;
  loading: boolean;
  loggingOut: boolean;
  loginHref: string;
  onLogin: () => void;
  onLogout: () => void;
};

export function GitHubAuthControl({
  user,
  loading,
  loggingOut,
  loginHref,
  onLogin,
  onLogout
}: GitHubAuthControlProps) {
  if (loading) {
    return (
      <button type="button" className="header-login-button" aria-busy="true" disabled>
        <Icons.Github className="w-4 h-4" />
        <span className="header-login-label">확인 중</span>
      </button>
    );
  }

  if (!user) {
    return (
      <a href={loginHref} onClick={onLogin} className="header-login-button">
        <Icons.Github className="w-4 h-4" />
        <span className="header-login-label">GitHub 로그인</span>
      </a>
    );
  }

  return (
    <div className="header-auth-user">
      <a
        href={user.profileUrl}
        target="_blank"
        rel="noreferrer"
        className="header-auth-profile"
        aria-label={`${user.login} GitHub 프로필 열기`}
      >
        <img
          src={user.avatarUrl}
          alt=""
          width="26"
          height="26"
          className="header-auth-avatar"
          referrerPolicy="no-referrer"
        />
        <span className="header-auth-user-name">{user.name}</span>
      </a>
      <button
        type="button"
        className="header-auth-logout"
        onClick={onLogout}
        disabled={loggingOut}
      >
        {loggingOut ? "처리 중" : "로그아웃"}
      </button>
    </div>
  );
}
