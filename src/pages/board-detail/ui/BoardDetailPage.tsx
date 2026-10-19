import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSession } from "../../../entities/session";
import { useBoardDetail } from "../model/useBoardDetail";
import { MandalartEditor } from "../../../widgets/mandalart-editor";
import { BoardProgress } from "../../../widgets/board-progress";
import { BoardGoals } from "../../../widgets/board-goals";
import { DeleteBoard } from "../../../features/delete-board";
import { SignIn } from "../../../features/sign-in";
import {
  download,
  LocalBoardError,
  recoverLocalBoard,
} from "../../../entities/board";
export function BoardDetailPage() {
  const { boardId = "" } = useParams(),
    { user } = useSession();
  if (boardId !== "local" && !user)
    return (
      <main className="list-page">
        <h1>로그인이 필요합니다.</h1>
        <SignIn />
      </main>
    );
  return <BoardDetail key={boardId} boardId={boardId} />;
}
function BoardDetail({ boardId }: { boardId: string }) {
  const query = useBoardDetail(boardId),
    navigate = useNavigate(),
    [selected, setSelected] = useState<string | null>(null),
    [draftDirty, setDraftDirty] = useState(false),
    [view, setView] = useState<"both" | "board" | "list">("both");
  function select(id: string | null) {
    if (id === selected) return true;
    if (
      draftDirty &&
      id !== selected &&
      !window.confirm("저장하지 않은 변경을 버릴까요?")
    )
      return false;
    setDraftDirty(false);
    setSelected(id);
    return true;
  }
  return (
    <main className="detail-page">
      <Link className="back-link" to="/boards">
        <ArrowLeft size={15} />내 보드
      </Link>
      <header className="detail-heading">
        <div>
          <span className="page-kicker">
            {boardId === "local" ? "이 브라우저에 저장" : "개인 보드"}
          </span>
          <h1>{query.data?.title ?? "보드"}</h1>
        </div>
        <div className="view-tabs" aria-label="표시 방식">
          {(["both", "board", "list"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => {
                if (
                  v === "list" &&
                  draftDirty &&
                  !window.confirm(
                    "저장하지 않은 변경을 버리고 목록으로 이동할까요?",
                  )
                )
                  return;
                if (v === "list") setDraftDirty(false);
                setView(v);
              }}
            >
              {v === "both" ? "전체" : v === "board" ? "표" : "목록"}
            </button>
          ))}
        </div>
      </header>
      {query.error && (
        <div className="notice" role="alert">
          {query.error.message}
          <button onClick={() => void query.refetch()}>다시 시도</button>
        </div>
      )}
      {boardId === "local" && query.error instanceof LocalBoardError && (
        <LocalRecovery
          error={query.error}
          onRecovered={() => void query.refetch()}
        />
      )}
      {boardId === "local" && <LegacyBackup />}
      <div className={`detail-layout view-${view}`}>
        <section className="editor-column">
          {view !== "list" && (
            <MandalartEditor
              boardId={boardId}
              selectedId={selected}
              onSelect={select}
              onDirtyChange={setDraftDirty}
            />
          )}
        </section>
        <aside className="summary-column">
          <BoardProgress boardId={boardId} />
          {view !== "board" && (
            <BoardGoals
              boardId={boardId}
              onSelect={(id) => {
                if (select(id)) setView("both");
              }}
            />
          )}
        </aside>
      </div>
      {query.data && boardId !== "local" && (
        <div className="board-management">
          <span>보드 이름은 중심 목표에서 수정할 수 있습니다.</span>
          <DeleteBoard
            board={query.data}
            onDeleted={() => navigate("/boards")}
          />
        </div>
      )}
    </main>
  );
}
function LocalRecovery({
  error,
  onRecovered,
}: {
  error: LocalBoardError;
  onRecovered: () => void;
}) {
  const [failure, setFailure] = useState("");
  return (
    <div className="notice">
      <p>원본은 보존되어 있습니다. 먼저 내려받은 뒤 기기 보드를 복구하세요.</p>
      {error.recovery !== undefined && (
        <button
          onClick={() =>
            download("mandalart-recovery.txt", error.recovery!, "text/plain")
          }
        >
          원본 내려받기
        </button>
      )}
      <button
        onClick={() => {
          if (
            !window.confirm(
              "원본 백업을 내려받았나요? 손상된 데이터의 별도 복사본을 남기고 새 기기 보드를 시작합니다.",
            )
          )
            return;
          try {
            recoverLocalBoard();
            onRecovered();
          } catch {
            setFailure(
              "기기 저장소를 사용할 수 없습니다. 브라우저 설정을 확인해주세요.",
            );
          }
        }}
      >
        기기 보드 복구
      </button>
      {failure && <p role="alert">{failure}</p>}
    </div>
  );
}
function LegacyBackup() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem("madalart-next-goals");
  } catch {}
  return raw ? (
    <div className="notice">
      <span>
        이전 버전 데이터가 있습니다. 원본을 백업한 뒤 가져오기로 복원할 수
        있습니다.
      </span>
      <button onClick={() => download("mandalart-previous-backup.json", raw!)}>
        원본 백업
      </button>
    </div>
  ) : null;
}
