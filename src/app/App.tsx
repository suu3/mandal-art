import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
} from "react-router-dom";
import { LayoutGrid, Moon, Sun, LogOut, Menu, X } from "lucide-react";
import { SessionProvider, useSession } from "../entities/session";
import { QueryProvider } from "./providers/QueryProvider";
import { BoardListPage } from "../pages/board-list";
import { BoardDetailPage } from "../pages/board-detail";
import { authClient } from "../entities/session";
export function App() {
  return (
    <SessionProvider>
      <SessionBoundary />
    </SessionProvider>
  );
}
function SessionBoundary() {
  const { user, pending } = useSession();
  if (pending)
    return (
      <div className="app-loading">
        만다라트 <span>불러오는 중…</span>
      </div>
    );
  return (
    <QueryProvider key={user?.id ?? "guest"}>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </QueryProvider>
  );
}
function Shell() {
  const { user } = useSession(),
    [open, setOpen] = useState(false),
    [theme, setTheme] = useState(
      document.documentElement.dataset.theme ?? "light",
    ),
    [error, setError] = useState("");
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("madalart-theme", next);
    } catch {}
  }
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        본문으로 바로가기
      </a>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="메뉴 닫기"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link className="brand" to="/boards" onClick={() => setOpen(false)}>
          <span className="brand-symbol" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          만다라트
        </Link>
        <div className="workspace-label">
          <span className="workspace-avatar">
            {user?.name?.slice(0, 1) ?? "M"}
          </span>
          <span>
            {user?.name ?? "나의 공간"}
            <small>{user ? "개인 워크스페이스" : "기기 저장 모드"}</small>
          </span>
        </div>
        <nav>
          <NavLink
            className="side-link"
            to="/boards"
            end
            onClick={() => setOpen(false)}
          >
            <LayoutGrid size={17} />내 보드
          </NavLink>
          <NavLink
            className="side-link"
            to="/boards/local"
            onClick={() => setOpen(false)}
          >
            기기 보드
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <p>
            중심 목표 하나와
            <br />
            여덟 가지 실천.
          </p>
          <span>만다라트</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="메뉴 열기"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span>워크스페이스</span>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label={theme === "light" ? "다크 모드" : "라이트 모드"}
              onClick={toggleTheme}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            {user ? (
              <button
                className="button secondary"
                onClick={async () => {
                  try {
                    const { error } = await authClient.signOut();
                    if (error) throw error;
                  } catch {
                    setError("로그아웃하지 못했습니다. 다시 시도해주세요.");
                  }
                }}
              >
                <LogOut size={15} />
                로그아웃
              </button>
            ) : (
              <Link className="button secondary" to="/boards">
                로그인
              </Link>
            )}
          </div>
        </header>
        {error && (
          <div role="alert" className="notice">
            {error}
          </div>
        )}
        <div id="main">
          <Routes>
            <Route path="/" element={<Navigate to="/boards" replace />} />
            <Route path="/boards" element={<BoardListPage />} />
            <Route path="/boards/:boardId" element={<BoardDetailPage />} />
            <Route path="*" element={<Navigate to="/boards" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
