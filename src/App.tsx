import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { OssAppProvider } from "./app/OssAppContext";
import { BrandMark, SITE_ICON_DATA_URL } from "./components/BrandMark";
import { GitHubAuthControl } from "./components/GitHubAuthControl";
import { Icons } from "./components/Icons";
import { LandingPage } from "./pages/LandingPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { initializeAnalytics, trackAnalyticsEvent } from "./services/analytics";
import { fetchAuthSession, getGithubLoginUrl, logoutGithub } from "./services/auth";
import type { AuthUser } from "./services/auth";
import { updateSeoMetadata } from "./services/seo";
import {
  clearLegacyWorkspaceItems,
  indexWorkspaceItems,
  readLegacyWorkspaceItems
} from "./services/userWorkspace";
import type { WorkspaceItem } from "./services/userWorkspace";
import { syncRemoteGithubPullRequests, syncWorkspaceItems } from "./services/workspace";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const view = location.pathname.startsWith("/mypage")
    ? "mypage"
    : location.pathname.startsWith("/portfolio") ? "portfolio" : "landing";
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authLogoutLoading, setAuthLogoutLoading] = useState(false);
  const [trackedTasks, setTrackedTasks] = useState<Record<string, WorkspaceItem>>(readLegacyWorkspaceItems);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => { initializeAnalytics(); }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchAuthSession(controller.signal)
      .then(user => { if (active) setAuthUser(user); })
      .catch(error => { if (active && error?.name !== "AbortError") setAuthUser(null); })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!authUser) {
      setTrackedTasks(readLegacyWorkspaceItems());
      setWorkspaceLoading(false);
      setWorkspaceError("");
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setWorkspaceLoading(true);
    setWorkspaceError("");
    syncWorkspaceItems(Object.values(readLegacyWorkspaceItems()), controller.signal)
      .then(items => {
        if (!active) return;
        setTrackedTasks(indexWorkspaceItems(items));
        clearLegacyWorkspaceItems();
      })
      .catch(error => {
        if (active && error?.name !== "AbortError") setWorkspaceError(error instanceof Error ? error.message : "기여 목록을 불러오지 못했습니다.");
      })
      .finally(() => { if (active) setWorkspaceLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [authLoading, authUser]);

  useEffect(() => {
    const parameters = new URLSearchParams(location.search);
    const errorCode = parameters.get("auth_error");
    if (!errorCode) return;
    const messages: Record<string, string> = {
      access_denied: "GitHub 로그인이 취소되었습니다.",
      invalid_flow: "로그인 요청이 만료되었습니다. 다시 시도해 주세요.",
      github_failed: "GitHub 로그인 중 오류가 발생했습니다. 다시 시도해 주세요."
    };
    setToast(messages[errorCode] || "GitHub 로그인을 완료하지 못했습니다.");
    parameters.delete("auth_error");
    navigate({ pathname: location.pathname, search: parameters.toString() ? `?${parameters}` : "" }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    updateSeoMetadata(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.type = "image/svg+xml";
    favicon.href = SITE_ICON_DATA_URL;
  }, []);

  const triggerToast = (message: string) => setToast(message);

  const handleGithubLogout = async () => {
    if (authLogoutLoading) return;
    setAuthLogoutLoading(true);
    try {
      await logoutGithub();
      setAuthUser(null);
      triggerToast("GitHub에서 로그아웃했습니다.");
      trackAnalyticsEvent("logout", { method: "github" });
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : "GitHub에서 로그아웃하지 못했습니다.");
    } finally {
      setAuthLogoutLoading(false);
    }
  };

  const syncGithubPullRequests = async (force = false, signal?: AbortSignal) => {
    if (!authUser) throw new Error("GitHub 로그인이 필요합니다.");
    const result = await syncRemoteGithubPullRequests(force, signal);
    setTrackedTasks(indexWorkspaceItems(result.items));
    return result;
  };

  const openWorkspaceItem = (item: WorkspaceItem) => {
    if (!item.url) return;
    window.open(item.url, "_blank", "noopener,noreferrer");
  };

  const contextValue = {
    authUser,
    authLoading,
    workspaceLoading,
    workspaceError,
    trackedTasks,
    syncGithubPullRequests,
    openWorkspaceItem,
    triggerToast
  };

  return (
    <OssAppProvider value={contextValue}>
      <div className={`app-root font-sans antialiased flex flex-col selection:bg-[#d5e0f8] selection:text-[#18201d] ${view === "landing" ? "app-root-landing" : ""}`}>
        {toast ? <div className="fixed bottom-6 right-6 z-50 bg-[#1f2933] text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 border border-[#30363d] text-sm animate-fade-in"><Icons.Check className="text-[#3fb950] w-4 h-4" /><span>{toast}</span></div> : null}

        {view !== "landing" ? <header className={`app-header ${view === "portfolio" ? "app-header-portfolio" : ""}`}>
          <div className="app-header-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <button type="button" className="app-brand flex items-center gap-3" onClick={() => navigate("/")}><span className="brand-mark"><BrandMark /></span><span className="brand-name font-bold text-[#1f2933] text-sm tracking-tight">기여로</span></button>
            {view !== "portfolio" && authUser ? <nav className="app-nav flex items-center gap-2" aria-label="주요 메뉴"><button type="button" onClick={() => navigate("/mypage")} className="nav-button nav-button-active text-xs px-3 py-1.5">내 기여</button><button type="button" onClick={() => navigate(`/portfolio/${encodeURIComponent(authUser.login)}`)} className="nav-button text-xs px-3 py-1.5">공개 페이지</button></nav> : null}
            {view !== "portfolio" ? <GitHubAuthControl user={authUser} loading={authLoading} loggingOut={authLogoutLoading} loginHref={getGithubLoginUrl(`${location.pathname}${location.search}${location.hash}`)} onLogin={() => trackAnalyticsEvent("login", { method: "github" })} onLogout={handleGithubLogout} /> : null}
          </div>
        </header> : null}

        <main className={`app-main flex-grow ${view === "landing" ? "landing-main" : ""}`}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/mypage" element={<WorkspacePage />} />
            <Route path="/portfolio/:login" element={<PortfolioPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {view === "mypage" ? <footer className="app-footer"><div className="app-footer-inner"><div className="app-footer-top"><div className="app-footer-brand"><span className="brand-mark"><BrandMark /></span><strong>기여로</strong></div><div className="app-footer-links"><Link to="/mypage">내 기여</Link><a href="#">개인정보 처리방침</a><a href="#">문의하기</a></div></div><p>오픈소스 기여를 기록하는 가장 간단한 방법. © 2026 기여로</p></div></footer> : null}
      </div>
    </OssAppProvider>
  );
}
