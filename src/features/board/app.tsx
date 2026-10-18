import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cloud,
  FileJson,
  FileUp,
  Github,
  Leaf,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Sprout,
  Sun,
  X,
} from "lucide-react";
import {
  childrenOf,
  demoGoals,
  newRoot,
  parseBackup,
  pathOf,
  progressOf,
  type Goal,
} from "../../domain/goals";
import { authClient } from "../auth/client";
import { useBoard } from "./use-board";
import { Inspector } from "./inspector";
import { download, exportCsv, exportJson, exportPng } from "./exports";
import { useDialogFocus } from "./use-dialog-focus";

const labels: Record<string, string> = {
  loading: "보드를 불러오는 중",
  local: "이 기기에 저장됨",
  saving: "저장 중…",
  saved: "클라우드에 저장됨",
  error: "클라우드 저장 대기",
  conflict: "다른 창의 변경 확인 필요",
  recovery: "기기 데이터 복구 필요",
  "local-error": "기기 백업 확인 필요",
};
function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? "small" : ""}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

export function App() {
  const { data: session, isPending } = authClient.useSession();
  const owner = session?.user.id ?? null;
  const board = useBoard(owner, isPending);
  const [currentId, setCurrentId] = useState("root");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme ?? "light",
  );
  const [message, setMessage] = useState("");
  const [loginReady, setLoginReady] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const capture = useRef<HTMLDivElement>(null);
  const helpScope = useRef<HTMLElement>(null);
  useDialogFocus(helpScope, help, () => setHelp(false));
  const originFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/config")
      .then((r) => r.json())
      .then((v) => {
        if (active)
          setLoginReady((v as { githubLogin?: boolean })?.githubLogin === true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setCurrentId("root");
    setSelectedId(null);
  }, [owner]);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(id);
  }, [message]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (owner && board.status !== "saved") {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [owner, board.status]);
  const goals = board.goals;
  const root = goals.find((g) => g.id === "root") ?? newRoot();
  const current = goals.find((g) => g.id === currentId) ?? root;
  const selected = goals.find((g) => g.id === selectedId);
  const children = childrenOf(goals, current.id);
  const progress = progressOf(goals, current.id);
  const completed = children.filter((g) => g.status === "done").length;
  const allLeaves = goals.filter(
    (g) => g.parentId && !childrenOf(goals, g.id).length,
  );
  const path = pathOf(goals, current.id);
  const navigation = (id: string) => {
    setCurrentId(id);
    setSelectedId(null);
    setSidebar(false);
  };
  function closeInspector() {
    setSelectedId(null);
    originFocus.current?.focus();
  }
  function select(id: string) {
    originFocus.current = document.activeElement as HTMLElement;
    setSelectedId(id);
  }
  function save(next: Goal[]) {
    try {
      board.persist(next);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "변경을 저장하지 못했습니다.",
      );
    }
  }
  function patch(id: string, changes: Partial<Goal>) {
    save(
      goals.map((g) =>
        g.id === id
          ? { ...g, ...changes, updatedAt: new Date().toISOString() }
          : g,
      ),
    );
  }
  function add(slot: number) {
    if (!board.ready) return;
    const goal: Goal = {
      ...newRoot(),
      id: crypto.randomUUID(),
      parentId: current.id,
      slot,
      title: "새로운 작은 실천",
      description: "",
    };
    save([...goals, goal]);
    select(goal.id);
  }
  function remove(goal: Goal) {
    if (
      !window.confirm(
        `“${goal.title}” 목표와 하위 목표를 삭제할까요? 필요하면 먼저 JSON으로 백업해주세요.`,
      )
    )
      return;
    const ids = new Set([goal.id]);
    let changed = true;
    while (changed) {
      changed = false;
      goals.forEach((g) => {
        if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) {
          ids.add(g.id);
          changed = true;
        }
      });
    }
    save(goals.filter((g) => !ids.has(g.id)));
    setSelectedId(null);
  }
  function move(slot: number) {
    setDragOver(null);
    const goal = children.find((g) => g.id === dragged);
    setDragged(null);
    if (!goal || goal.slot === slot) return;
    const other = children.find((g) => g.slot === slot);
    save(
      goals.map((g) =>
        g.id === goal.id
          ? { ...g, slot }
          : g.id === other?.id
            ? { ...g, slot: goal.slot }
            : g,
      ),
    );
  }
  async function importFile(fileValue: File | undefined) {
    if (!fileValue) return;
    try {
      if (fileValue.size > 262144)
        throw new Error("백업 파일은 256KiB 이하여야 합니다.");
      const next = parseBackup(await fileValue.text());
      if (
        !window.confirm(
          "현재 보드를 가져온 파일로 교체할까요? 기존 보드는 먼저 JSON으로 백업해주세요.",
        )
      )
        return;
      save(next);
      navigation("root");
      setMessage("백업을 불러왔습니다.");
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "파일을 읽지 못했습니다. 원본 파일은 보관해주세요.",
      );
    }
  }
  async function signIn() {
    if (!loginReady) {
      setMessage(
        "클라우드 로그인은 준비 중이에요. 지금은 이 기기에 저장되며 JSON 백업도 가능해요.",
      );
      return;
    }
    setAuthBusy(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "github",
        callbackURL: window.location.origin,
      });
      if (error) throw new Error(error.message);
    } catch {
      setMessage("로그인을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.");
      setAuthBusy(false);
    }
  }
  function toggleTheme() {
    const value = theme === "light" ? "dark" : "light";
    setTheme(value);
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem("madalart-theme", value);
    } catch {}
  }
  const tree = (goal: Goal, depth = 0): React.ReactNode => (
    <div key={goal.id}>
      <button
        className={`tree-item ${current.id === goal.id ? "active" : ""}`}
        style={{ paddingLeft: `${16 + Math.min(depth, 5) * 14}px` }}
        onClick={() => navigation(goal.id)}
        title={goal.title}
        aria-current={current.id === goal.id ? "page" : undefined}
      >
        {goal.id === "root" ? (
          <Mark small />
        ) : (
          <span className={`tree-dot ${goal.status === "done" ? "done" : ""}`}>
            {goal.status === "done" && <Check size={10} />}
          </span>
        )}
        <span>{goal.title}</span>
        {childrenOf(goals, goal.id).length > 0 && <ChevronRight size={13} />}
      </button>
      {childrenOf(goals, goal.id).map((g) => tree(g, depth + 1))}
    </div>
  );

  return (
    <div className="app">
      <a className="skip-link" href="#board-main">
        보드로 바로가기
      </a>
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label="목표 목록 닫기"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside
        className={`sidebar ${sidebar ? "open" : ""}`}
        aria-label="목표 탐색"
      >
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigation("root");
          }}
        >
          <Mark />
          <span>
            만다라트<span className="brand-caption">A LITTLE, EVERY DAY</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">
            {session?.user.name?.slice(0, 1) ?? "M"}
          </span>
          <span>
            {session ? `${session.user.name}의 공간` : "나의 작은 작업실"}
            <small>
              {owner ? "개인 워크스페이스" : "로그인 없이도 시작하세요"}
            </small>
          </span>
        </div>
        <div className="sidebar-heading">
          <span>나의 목표 지도</span>
          <span className="count-badge">{goals.length}</span>
        </div>
        <nav className="goal-tree">{tree(root)}</nav>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <Sprout size={27} strokeWidth={1.1} />
            <p>
              서두르지 않아도,
              <br />
              멈추지 않으면 자라나요.
            </p>
            <span>YOUR PACE, YOUR PATH.</span>
          </div>
          <button className="help-link" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            만다라트 사용 가이드
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-foot">
            <span>작은 실천, 나다운 성장</span>
            <span>v.02</span>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="목표 목록 열기"
              onClick={() => setSidebar(true)}
            >
              <Menu size={20} />
            </button>
            <span className="topbar-label">나의 만다라트</span>
            <ChevronRight size={14} />
            <span className="topbar-current">
              {current.parentId === null ? "목표 지도" : current.title}
            </span>
          </div>
          <div className="topbar-actions">
            <span
              className={`save-status ${["error", "conflict", "local-error"].includes(board.status) ? "warning" : ""}`}
              role="status"
            >
              <i />
              {labels[board.status] ?? board.status}
            </span>
            <button
              className="icon-button theme-button"
              aria-label={theme === "light" ? "다크 모드" : "라이트 모드"}
              onClick={toggleTheme}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            {session ? (
              <button
                className="button login-button"
                onClick={() => {
                  void authClient
                    .signOut()
                    .catch(() => setMessage("로그아웃하지 못했습니다."));
                }}
              >
                <LogOut size={15} />
                <span>로그아웃</span>
              </button>
            ) : (
              <button
                className="button login-button"
                disabled={authBusy || isPending}
                onClick={() => void signIn()}
              >
                <Github size={16} />
                <span>{authBusy ? "연결 중…" : "로그인"}</span>
              </button>
            )}
          </div>
        </header>

        <main
          id="board-main"
          className={`workspace ${selected ? "with-inspector" : ""}`}
        >
          <section className="board-workspace">
            {(board.error ||
              ["error", "conflict", "recovery"].includes(board.status)) && (
              <div className="notice" role="alert">
                <span>
                  {board.status === "conflict"
                    ? "다른 창에서 변경된 보드가 있어요. 내 변경을 백업한 뒤 다시 불러와주세요."
                    : (board.error ??
                      "변경이 기기에 남아 있어요. 연결을 확인하고 다시 저장해주세요.")}
                </span>
                <div>
                  <button onClick={() => exportJson(goals)}>JSON 백업</button>
                  {board.recovery && (
                    <button
                      onClick={() =>
                        download(
                          "mandalart-recovery.txt",
                          board.recovery!,
                          "text/plain",
                        )
                      }
                    >
                      원본 내려받기
                    </button>
                  )}
                  {board.status === "recovery" ? (
                    <button onClick={board.recover}>새 보드 시작</button>
                  ) : board.status === "conflict" ? (
                    <button onClick={board.refresh}>서버 다시 불러오기</button>
                  ) : (
                    <button onClick={board.retry}>다시 시도</button>
                  )}
                </div>
              </div>
            )}
            {board.legacy && (
              <div className="notice legacy">
                <span>
                  이전 버전의 기기 저장 데이터가 있어요. 원본을 내려받고
                  가져오기로 복원할 수 있어요.
                </span>
                <button
                  onClick={() =>
                    download("mandalart-previous-backup.json", board.legacy!)
                  }
                >
                  이전 데이터 백업
                </button>
              </div>
            )}
            <div className="page-heading">
              <div className="eyebrow">
                <span className="tiny-line" />
                MY GROWTH MAP
              </div>
              <h1>
                오늘의 작은 실천이,
                <br />
                <span>내일의 나를 만듭니다.</span>
              </h1>
              <p>머릿속에만 있던 목표를 꺼내, 한 칸씩 채워보세요.</p>
              <div className="heading-botanical" aria-hidden="true">
                <Leaf size={66} strokeWidth={0.8} />
                <span>
                  grow at
                  <br />
                  your own pace.
                </span>
              </div>
            </div>

            <div className="board-toolbar">
              <nav className="breadcrumbs" aria-label="현재 목표 경로">
                {path.map((g, i) => (
                  <span key={g.id}>
                    {i > 0 && <ChevronRight size={13} />}
                    <button
                      onClick={() => navigation(g.id)}
                      aria-current={
                        i === path.length - 1 ? "location" : undefined
                      }
                    >
                      {i === 0 ? "나의 목표" : g.title}
                    </button>
                  </span>
                ))}
              </nav>
              <div className="board-tools">
                <span className="board-view-label">
                  <Mark small />
                  보드 보기
                </span>
                <details className="export-menu">
                  <summary aria-label="보드 메뉴">
                    <MoreHorizontal size={21} />
                  </summary>
                  <div className="dropdown">
                    <button onClick={() => exportJson(goals)}>
                      <FileJson size={16} />
                      JSON으로 백업
                    </button>
                    <button
                      disabled={!board.ready}
                      onClick={() => file.current?.click()}
                    >
                      <FileUp size={16} />
                      백업 가져오기
                    </button>
                    <button onClick={() => exportCsv(goals)}>
                      <ArrowDownToLine size={16} />
                      CSV 내보내기
                    </button>
                    <button
                      disabled={exporting}
                      onClick={async () => {
                        if (!capture.current) return;
                        setExporting(true);
                        try {
                          await exportPng(capture.current);
                        } catch {
                          setMessage(
                            "이미지를 만들지 못했습니다. 다시 시도해주세요.",
                          );
                        } finally {
                          setExporting(false);
                        }
                      }}
                    >
                      <ArrowDownToLine size={16} />
                      {exporting ? "이미지 만드는 중…" : "보드 이미지 저장"}
                    </button>
                    <hr />
                    <button
                      disabled={!board.ready}
                      onClick={() => {
                        if (
                          window.confirm(
                            "현재 보드를 비우고 새 목표를 시작할까요? 먼저 JSON 백업을 권장해요.",
                          )
                        ) {
                          save([newRoot()]);
                          navigation("root");
                        }
                      }}
                    >
                      <RotateCcw size={16} />새 보드 시작
                    </button>
                    <button
                      disabled={!board.ready}
                      onClick={() => {
                        if (
                          window.confirm("현재 보드를 예시 보드로 교체할까요?")
                        ) {
                          save(demoGoals());
                          navigation("root");
                        }
                      }}
                    >
                      <Sprout size={16} />
                      예시 보드 보기
                    </button>
                  </div>
                </details>
              </div>
            </div>
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              className="visually-hidden"
              aria-label="JSON 백업 파일"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            <div className="board-paper" ref={capture}>
              <div className="paper-heading">
                <div>
                  <span className="paper-index">
                    {current.parentId === null
                      ? "01"
                      : String(current.slot + 1).padStart(2, "0")}
                  </span>
                  <h2>{current.title}</h2>
                </div>
                <span className="paper-caption">
                  ONE GOAL, EIGHT POSSIBILITIES
                </span>
              </div>
              <div
                className="mandala-grid"
                aria-label="만다라트 목표 보드"
                aria-busy={!board.ready}
              >
                {Array.from({ length: 9 }, (_, index) => {
                  if (index === 4)
                    return (
                      <div className="goal-card core-card" key="core">
                        <span className="card-kicker">
                          <Mark small />
                          MY CORE GOAL
                        </span>
                        <button
                          className="core-title"
                          disabled={!board.ready}
                          onClick={() => select(current.id)}
                        >
                          {current.title}
                        </button>
                        <p>{current.description || "나의 중심이 되는 목표"}</p>
                        <div className="core-bottom">
                          <span>한 걸음씩, 나의 속도로</span>
                          <button
                            className="core-edit"
                            aria-label="중심 목표 편집"
                            disabled={!board.ready}
                            onClick={() => select(current.id)}
                          >
                            <ArrowUpRight size={19} />
                          </button>
                        </div>
                        <span className="core-orbit" aria-hidden="true" />
                      </div>
                    );
                  const slot = index < 4 ? index : index - 1;
                  const goal = children.find((g) => g.slot === slot);
                  return (
                    <div
                      key={slot}
                      className={`goal-card tone-${slot} ${goal?.status === "done" ? "completed" : ""} ${selectedId === goal?.id ? "selected" : ""} ${dragOver === slot ? "drag-over" : ""} ${!goal ? "empty-card" : ""}`}
                      draggable={Boolean(goal && board.ready)}
                      onDragStart={(e) => {
                        if (goal) {
                          e.dataTransfer.setData("text/plain", goal.id);
                          setDragged(goal.id);
                        }
                      }}
                      onDragEnd={() => {
                        setDragged(null);
                        setDragOver(null);
                      }}
                      onDragOver={(e) => {
                        if (dragged) {
                          e.preventDefault();
                          setDragOver(slot);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        move(slot);
                      }}
                    >
                      {goal ? (
                        <>
                          <div className="card-top">
                            <span className="card-number">
                              {String(slot + 1).padStart(2, "0")}
                            </span>
                            <span className={`status-tag ${goal.status}`}>
                              {goal.status === "done"
                                ? "완료"
                                : goal.status === "doing"
                                  ? "진행 중"
                                  : "시작 전"}
                            </span>
                          </div>
                          <button
                            className="card-title"
                            disabled={!board.ready}
                            onClick={() => select(goal.id)}
                          >
                            {goal.title}
                          </button>
                          <p className="card-description">
                            {goal.description || "어떤 작은 실천을 해볼까요?"}
                          </p>
                          <div className="card-bottom">
                            {childrenOf(goals, goal.id).length ? (
                              <span className="subgoal-progress">
                                <span className="mini-track">
                                  <i
                                    style={{
                                      width: `${progressOf(goals, goal.id)}%`,
                                    }}
                                  />
                                </span>
                                {progressOf(goals, goal.id)}%
                              </span>
                            ) : (
                              <button
                                className={`completion-button ${goal.status === "done" ? "checked" : ""}`}
                                disabled={!board.ready}
                                aria-label={`${goal.title} ${goal.status === "done" ? "완료 취소" : "완료하기"}`}
                                onClick={() =>
                                  patch(goal.id, {
                                    status:
                                      goal.status === "done" ? "todo" : "done",
                                  })
                                }
                              >
                                {goal.status === "done" ? (
                                  <Check size={13} />
                                ) : (
                                  <span />
                                )}
                                <span>
                                  {goal.status === "done"
                                    ? "해냈어요"
                                    : "완료하기"}
                                </span>
                              </button>
                            )}
                            <button
                              className="enter-goal"
                              disabled={!board.ready}
                              aria-label={`${goal.title} 하위 목표 보기`}
                              onClick={() => navigation(goal.id)}
                            >
                              <ArrowUpRight size={17} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          className="add-goal"
                          disabled={!board.ready}
                          onClick={() => add(slot)}
                        >
                          <span className="empty-number">
                            {String(slot + 1).padStart(2, "0")}
                          </span>
                          <span className="add-circle">
                            <Plus size={23} strokeWidth={1.2} />
                          </span>
                          <span>작은 실천 추가</span>
                          <small>가능성을 한 칸 더</small>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="board-progress-row">
                <span>
                  <span className="progress-dot" />
                  {completed}개의 실천을 이뤘어요
                  <span className="muted"> / {children.length}개</span>
                </span>
                <div className="board-progress">
                  <div className="progress-track">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                  <strong>{progress}%</strong>
                </div>
              </div>
            </div>
            <div className="board-caption">
              <span>
                <span className="caption-asterisk">✳</span>목표 이름을 눌러
                편집하고, 화살표로 작은 실천을 더해보세요.
              </span>
              {current.parentId && (
                <button
                  className="text-button"
                  onClick={() => navigation(current.parentId!)}
                >
                  <ArrowLeft size={14} />
                  상위 목표
                </button>
              )}
            </div>
            <section className="next-step">
              <div className="next-step-icon">
                <Sprout size={23} strokeWidth={1.3} />
              </div>
              <div>
                <span className="eyebrow">A SMALL STEP FOR TODAY</span>
                <h3>
                  {allLeaves.find((g) => g.status !== "done")?.title ??
                    "오늘의 한 걸음, 충분히 잘했어요."}
                </h3>
                <p>거창하지 않아도 괜찮아요. 하나만 시작해볼까요?</p>
              </div>
              {allLeaves.some((g) => g.status !== "done") && (
                <button
                  className="next-step-button"
                  aria-label="다음 실천 편집"
                  onClick={() =>
                    select(allLeaves.find((g) => g.status !== "done")!.id)
                  }
                >
                  <ArrowUpRight size={21} />
                </button>
              )}
            </section>
            <footer className="workspace-footer">
              <span>MADE FOR YOUR OWN KIND OF GROWTH.</span>
              <span>
                조금씩, 꾸준히.<span className="footer-flower">✳</span>
              </span>
            </footer>
          </section>
          {selected && (
            <>
              <button
                className="inspector-scrim"
                aria-label="목표 상세 닫기"
                onClick={closeInspector}
              />
              <Inspector
                goal={selected}
                goals={goals}
                onPatch={(changes) => patch(selected.id, changes)}
                onClose={closeInspector}
                onEnter={() => navigation(selected.id)}
                onDelete={() => remove(selected)}
              />
            </>
          )}
        </main>
      </div>
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="알림 닫기"
            onClick={() => setMessage("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            ref={helpScope}
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              aria-label="가이드 닫기"
              onClick={() => setHelp(false)}
              autoFocus
            >
              <X size={20} />
            </button>
            <Mark />
            <h2 id="help-title">
              큰 목표를,
              <br />
              작은 실천으로.
            </h2>
            <ol>
              <li>중앙 칸에 이루고 싶은 중심 목표를 적어요.</li>
              <li>주변 8칸을 작은 실천으로 채워보세요.</li>
              <li>화살표를 누르면 목표를 더 잘게 나눌 수 있어요.</li>
              <li>실천을 마치면 완료 표시로 성장을 기록해요.</li>
            </ol>
            <p>
              비로그인 보드는 이 브라우저에 저장돼요. 메뉴에서 JSON 백업을
              내려받으면 다른 기기로 옮길 수 있어요. 로그인 후에는 별도의
              클라우드 보드를 사용합니다.
            </p>
            <button className="button primary" onClick={() => setHelp(false)}>
              나의 속도로 시작하기
              <ArrowUpRight size={17} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
