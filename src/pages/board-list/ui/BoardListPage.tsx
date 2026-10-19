import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { boardListOptions } from "../../../entities/board";
import { useSession } from "../../../entities/session";
import { CreateBoard } from "../../../features/create-board";
import { SignIn } from "../../../features/sign-in";
export function BoardListPage() {
  const { user } = useSession(),
    navigate = useNavigate();
  const query = useQuery({ ...boardListOptions(), enabled: Boolean(user) });
  return (
    <main className="list-page">
      <header className="page-heading">
        <div>
          <span className="page-kicker">워크스페이스</span>
          <h1>내 보드</h1>
          <p>목표별로 보드를 만들고 진행 상황을 확인하세요.</p>
        </div>
        {user && <CreateBoard onCreated={(id) => navigate(`/boards/${id}`)} />}
      </header>
      {!user ? (
        <section className="login-panel">
          <h2>어디서든 이어서 작성하세요.</h2>
          <p>로그인하면 여러 보드를 만들고 다른 기기에서도 열 수 있습니다.</p>
          <SignIn />
          <Link className="text-button" to="/boards/local">
            로그인 없이 기기 보드 열기
            <ArrowUpRight size={15} />
          </Link>
        </section>
      ) : query.isPending ? (
        <p className="loading-panel">보드 목록을 불러오는 중…</p>
      ) : query.error ? (
        <div className="notice" role="alert">
          {query.error.message}
          <button onClick={() => void query.refetch()}>다시 시도</button>
        </div>
      ) : (
        <section className="board-list" aria-label="내 보드 목록">
          {query.data?.map((board, i) => (
            <Link
              key={board.id}
              className="board-list-card"
              to={`/boards/${board.id}`}
            >
              <div className="board-list-preview" aria-hidden="true">
                {Array.from({ length: 9 }, (_, j) => (
                  <i key={j} className={j === 4 ? "center" : ""} />
                ))}
              </div>
              <div className="board-card-meta">
                <h2>{board.title}</h2>
                <span>
                  {new Intl.DateTimeFormat("ko-KR", {
                    dateStyle: "medium",
                  }).format(new Date(board.updatedAt))}{" "}
                  수정
                </span>
              </div>
              <ArrowUpRight size={20} />
            </Link>
          ))}
          {query.data?.length === 0 && (
            <div className="empty-list">
              <h2>아직 보드가 없습니다.</h2>
              <p>새 보드를 만들어 중심 목표부터 작성해보세요.</p>
            </div>
          )}
        </section>
      )}
      {user && (
        <Link className="local-board-link" to="/boards/local">
          이 브라우저에 저장한 기기 보드 보기
          <ArrowUpRight size={14} />
        </Link>
      )}
    </main>
  );
}
