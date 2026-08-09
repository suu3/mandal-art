"use client";

import { Check, ChevronRight, ChevronUp, Download, FileJson, FileUp, LogIn, LogOut, Moon, Plus, RotateCcw, Save, Sun, TableProperties, Trash2 } from "lucide-react";
import { ChangeEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toPng } from "html-to-image";
import { authClient } from "@/lib/auth-client";
import { sampleGoals } from "@/lib/sample-goals";
import type { Goal, GoalPriority, GoalStatus } from "@/lib/types";

const LOCAL_KEY = "madalart-next-goals";
const SHARE_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });

const authSchema = z.object({
  email: z.string().min(1, "이메일을 입력해주세요.").email("올바른 이메일 형식이 아니에요."),
  password: z.string().min(1, "비밀번호를 입력해주세요.").min(8, "비밀번호는 8자 이상이어야 해요.")
});

type AuthFormValues = z.infer<typeof authSchema>;

const statusLabels: Record<GoalStatus, string> = {
  todo: "예정",
  doing: "진행 중",
  done: "완료"
};

const priorityLabels: Record<GoalPriority, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음"
};

function now() {
  return new Date().toISOString();
}

function blankRootGoal(ownerId: string | null): Goal {
  return {
    id: "root",
    ownerId,
    parentId: null,
    slot: 0,
    title: "나의 목표",
    description: "중앙 칸을 눌러 핵심 목표를 정하고, 주변 8칸에 실행 목표를 채워보세요.",
    status: "todo",
    priority: "medium",
    dueDate: null,
    imageUrl: null,
    createdAt: now(),
    updatedAt: now()
  };
}

function safeFileName(value: string) {
  return value
    .trim()
    .replace(/[^\w가-힣-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function downloadFile(fileName: string, href: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeGoals(goals: Goal[]) {
  return goals.map((goal) => ({
    ...goal,
    imageUrl: goal.imageUrl ?? null,
    dueDate: goal.dueDate ?? null
  }));
}

function parseImportedGoals(value: unknown, fallbackOwnerId: string | null): Goal[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null && Array.isArray((value as { goals?: unknown }).goals)
      ? (value as { goals: unknown[] }).goals
      : [];

  return source
    .filter((goal): goal is Partial<Goal> => typeof goal === "object" && goal !== null)
    .map((goal, index) => ({
      id: typeof goal.id === "string" ? goal.id : `goal-${crypto.randomUUID()}`,
      ownerId: fallbackOwnerId,
      parentId: typeof goal.parentId === "string" ? goal.parentId : null,
      slot: typeof goal.slot === "number" && goal.slot >= 0 && goal.slot <= 7 ? goal.slot : index % 8,
      title: typeof goal.title === "string" && goal.title.trim() ? goal.title : "복원한 목표",
      description: typeof goal.description === "string" ? goal.description : "",
      status: goal.status === "doing" || goal.status === "done" ? goal.status : "todo",
      priority: goal.priority === "low" || goal.priority === "high" ? goal.priority : "medium",
      dueDate: typeof goal.dueDate === "string" ? goal.dueDate : null,
      imageUrl: typeof goal.imageUrl === "string" ? goal.imageUrl : null,
      createdAt: typeof goal.createdAt === "string" ? goal.createdAt : now(),
      updatedAt: now()
    }));
}

function childrenOf(goals: Goal[], parentId: string) {
  return goals.filter((goal) => goal.parentId === parentId).sort((a, b) => a.slot - b.slot);
}

function progressOf(goals: Goal[], goalId: string) {
  const goal = goals.find((item) => item.id === goalId);
  const children = childrenOf(goals, goalId);
  if (!children.length) return goal?.status === "done" ? 100 : 0;
  return Math.round((children.filter((child) => child.status === "done").length / children.length) * 100);
}

function pathOf(goals: Goal[], goalId: string) {
  const path: Goal[] = [];
  let cursor = goals.find((goal) => goal.id === goalId);

  while (cursor) {
    path.unshift(cursor);
    cursor = cursor.parentId ? goals.find((goal) => goal.id === cursor?.parentId) : undefined;
  }

  return path;
}

function descendantIdsOf(goals: Goal[], goalId: string) {
  const ids = new Set<string>();
  const visit = (id: string) => {
    childrenOf(goals, id).forEach((child) => {
      ids.add(child.id);
      visit(child.id);
    });
  };

  visit(goalId);
  return ids;
}

function canMutateGoalDirectly(goals: Goal[], goal: Goal) {
  return childrenOf(goals, goal.id).length === 0;
}

function burstParticles(x: number, y: number) {
  const rootStyles = getComputedStyle(document.documentElement);
  const colors = [
    rootStyles.getPropertyValue("--ok-ink").trim() || "#3fbf5f",
    rootStyles.getPropertyValue("--ink").trim() || "#ededed",
    rootStyles.getPropertyValue("--muted").trim() || "#8f8f8f"
  ];
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none;";
  document.body.appendChild(host);

  for (let i = 0; i < 18; i += 1) {
    const particle = document.createElement("span");
    const size = 4 + Math.random() * 5;
    particle.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:${
      Math.random() < 0.5 ? "999px" : "1px"
    };background:${colors[i % colors.length]};will-change:transform,opacity;`;
    host.appendChild(particle);

    const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.6;
    const distance = 36 + Math.random() * 64;
    particle.animate(
      [
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${
            Math.sin(angle) * distance + 46
          }px)) scale(0.3) rotate(${Math.random() * 300 - 150}deg)`,
          opacity: 0
        }
      ],
      { duration: 650 + Math.random() * 350, easing: "cubic-bezier(0.16, 0.84, 0.34, 1)", fill: "forwards" }
    );
  }

  window.setTimeout(() => host.remove(), 1100);
}

export function MandalArtApp() {
  const boardRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [goals, setGoals] = useState<Goal[]>(sampleGoals);
  const [currentGoalId, setCurrentGoalId] = useState("root");
  const [selectedGoalId, setSelectedGoalId] = useState("root");
  const [storageMode, setStorageMode] = useState<"loading" | "local" | "cloud">("loading");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors: authErrors }
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "" }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [dragGoalId, setDragGoalId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem("madalart-theme", next);
    } catch {
      // 저장 실패는 무시 (프라이빗 모드 등)
    }
  }

  const { data: authSession, isPending: isAuthPending } = authClient.useSession();
  const ownerId = authSession?.user.id ?? null;

  const currentGoal = goals.find((goal) => goal.id === currentGoalId) ?? goals[0];
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) ?? currentGoal;
  const children = useMemo(() => childrenOf(goals, currentGoal.id), [goals, currentGoal.id]);
  const currentProgress = progressOf(goals, currentGoal.id);
  const selectedProgress = progressOf(goals, selectedGoal.id);
  const slots = Array.from({ length: 8 }, (_, slot) => children.find((child) => child.slot === slot) ?? null);
  const boardItems = [...slots.slice(0, 4), currentGoal, ...slots.slice(4)];

  useEffect(() => {
    if (isAuthPending) return;
    let active = true;

    async function boot() {
      if (ownerId) {
        try {
          const response = await fetch("/api/goals");
          if (!response.ok) throw new Error(`목표 불러오기 실패 (${response.status})`);

          const payload = (await response.json()) as { goals: Goal[] };
          let nextGoals = normalizeGoals(payload.goals ?? []);
          if (!nextGoals.length) {
            nextGoals = [blankRootGoal(ownerId)];
            await fetch("/api/goals", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ goals: nextGoals })
            });
          }

          if (!active) return;
          setGoals(nextGoals);
          setCurrentGoalId((prev) => (nextGoals.some((goal) => goal.id === prev) ? prev : nextGoals[0].id));
          setSelectedGoalId((prev) => (nextGoals.some((goal) => goal.id === prev) ? prev : nextGoals[0].id));
          setStorageMode("cloud");
          return;
        } catch (error) {
          console.warn("서버 동기화 실패, 로컬 저장으로 전환합니다.", error);
        }
      }

      const local = window.localStorage.getItem(LOCAL_KEY);
      if (!active) return;
      setGoals(local ? normalizeGoals(JSON.parse(local)) : sampleGoals);
      setStorageMode("local");
    }

    boot();
    return () => {
      active = false;
    };
  }, [ownerId, isAuthPending]);

  async function persist(nextGoals: Goal[]) {
    setGoals(nextGoals);
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(nextGoals));

    if (storageMode !== "cloud" || !ownerId) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: nextGoals })
      });
      if (!response.ok) throw new Error(`저장 실패 (${response.status})`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }

  async function runAuth(action: () => Promise<{ error?: { message?: string } | null }>) {
    setAuthError(null);
    setIsAuthBusy(true);
    try {
      const { error } = await action();
      if (error) {
        setAuthError(error.message ?? "요청에 실패했어요. 서버 설정을 확인해주세요.");
      } else {
        resetField("password");
      }
    } catch {
      setAuthError("서버에 연결하지 못했어요. DATABASE_URL 설정을 확인해주세요.");
    } finally {
      setIsAuthBusy(false);
    }
  }

  function signIn(values: AuthFormValues) {
    runAuth(() => authClient.signIn.email({ email: values.email, password: values.password }));
  }

  function signUp(values: AuthFormValues) {
    runAuth(() =>
      authClient.signUp.email({
        email: values.email,
        password: values.password,
        name: values.email.split("@")[0] || "메이트"
      })
    );
  }

  async function signOut() {
    await authClient.signOut();
  }

  function patchGoal(goalId: string, patch: Partial<Goal>) {
    const nextGoals = goals.map((goal) =>
      goal.id === goalId ? { ...goal, ...patch, updatedAt: now(), ownerId: ownerId ?? goal.ownerId } : goal
    );
    persist(nextGoals);
  }

  function moveGoalToSlot(goalId: string, targetSlot: number) {
    const goal = goals.find((item) => item.id === goalId);
    if (!goal || goal.parentId !== currentGoal.id || goal.slot === targetSlot) return;

    const occupant = children.find((child) => child.slot === targetSlot);
    const nextGoals = goals.map((item) => {
      if (item.id === goal.id) return { ...item, slot: targetSlot, updatedAt: now() };
      if (occupant && item.id === occupant.id) return { ...item, slot: goal.slot, updatedAt: now() };
      return item;
    });

    persist(nextGoals);
    setSelectedGoalId(goal.id);
  }

  function handleSlotDrop(targetSlot: number) {
    if (dragGoalId) moveGoalToSlot(dragGoalId, targetSlot);
    setDragGoalId(null);
    setDragOverSlot(null);
  }

  function handleWorkspaceClick(event: ReactMouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest(".goalCard, .breadcrumb, .heroStats")) return;
    setSelectedGoalId(currentGoal.id);
  }

  function createGoal(slot: number) {
    const id = `goal-${crypto.randomUUID()}`;
    const goal: Goal = {
      id,
      ownerId,
      parentId: currentGoal.id,
      slot,
      title: "새 목표",
      description: "",
      status: "todo",
      priority: "medium",
      dueDate: null,
      imageUrl: null,
      createdAt: now(),
      updatedAt: now()
    };

    persist([...goals, goal]);
    setSelectedGoalId(id);
  }

  function toggleGoalDone(goal: Goal, origin?: { x: number; y: number }) {
    if (!canMutateGoalDirectly(goals, goal)) return;
    const nextDone = goal.status !== "done";
    patchGoal(goal.id, { status: nextDone ? "done" : "todo" });
    if (nextDone && origin) burstParticles(origin.x, origin.y);
  }

  async function removeGoal(goal: Goal) {
    if (!canMutateGoalDirectly(goals, goal) || goal.parentId === null) return;

    const removingIds = descendantIdsOf(goals, goal.id);
    removingIds.add(goal.id);
    const nextGoals = goals.filter((item) => !removingIds.has(item.id));
    const nextSelectedId = removingIds.has(selectedGoal.id) ? goal.parentId : selectedGoal.id;
    const nextCurrentId = removingIds.has(currentGoal.id) ? goal.parentId : currentGoal.id;

    setGoals(nextGoals);
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(nextGoals));
    setSelectedGoalId(nextSelectedId);
    setCurrentGoalId(nextCurrentId);

    if (storageMode !== "cloud" || !ownerId) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/goals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(removingIds) })
      });
      if (!response.ok) throw new Error(`삭제 실패 (${response.status})`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }

  async function resetBoard() {
    if (!window.confirm("모든 목표를 삭제하고 처음 상태로 되돌릴까요?")) return;

    if (storageMode === "cloud" && ownerId) {
      const removingIds = goals.map((goal) => goal.id);
      const root = blankRootGoal(ownerId);
      setGoals([root]);
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify([root]));
      setCurrentGoalId(root.id);
      setSelectedGoalId(root.id);

      setIsSaving(true);
      try {
        if (removingIds.length) {
          await fetch("/api/goals", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: removingIds })
          });
        }
        await fetch("/api/goals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goals: [root] })
        });
      } catch (error) {
        console.error(error);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    persist(sampleGoals.map((goal) => ({ ...goal, ownerId })));
    setCurrentGoalId("root");
    setSelectedGoalId("root");
  }

  function exportJson() {
    const payload = {
      app: "만다라트",
      version: 2,
      exportedAt: now(),
      currentGoalId: currentGoal.id,
      selectedGoalId: selectedGoal.id,
      goals
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    downloadFile(`madalart-${safeFileName(currentGoal.title) || "board"}.json`, url);
    URL.revokeObjectURL(url);
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const nextGoals = parseImportedGoals(payload, ownerId);
      if (!nextGoals.length) throw new Error("No goals in import payload");

      const hasRoot = nextGoals.some((goal) => goal.parentId === null);
      const restoredGoals = hasRoot ? nextGoals : [blankRootGoal(ownerId), ...nextGoals];
      await persist(restoredGoals);
      const nextCurrentGoalId = restoredGoals.find((goal) => goal.parentId === null)?.id ?? restoredGoals[0].id;
      setCurrentGoalId(nextCurrentGoalId);
      setSelectedGoalId(nextCurrentGoalId);
    } catch (error) {
      console.error("JSON 복원에 실패했습니다.", error);
    } finally {
      event.target.value = "";
    }
  }

  function exportCsv() {
    const rows = [
      ["id", "parent_id", "slot", "title", "description", "status", "priority", "due_date", "progress", "image_url"],
      ...goals.map((goal) => [
        goal.id,
        goal.parentId ?? "",
        goal.slot,
        goal.title,
        goal.description,
        statusLabels[goal.status],
        priorityLabels[goal.priority],
        goal.dueDate ?? "",
        progressOf(goals, goal.id),
        goal.imageUrl ?? ""
      ])
    ];
    const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    downloadFile(`madalart-${safeFileName(currentGoal.title) || "board"}.csv`, url);
    URL.revokeObjectURL(url);
  }

  async function exportPng() {
    if (!boardRef.current) return;

    setIsExportingPng(true);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
      const dataUrl = await toPng(boardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: document.documentElement.dataset.theme === "light" ? "#fafafa" : "#0a0a0a"
      });
      downloadFile(`madalart-${safeFileName(currentGoal.title) || "board"}.png`, dataUrl);
    } finally {
      setIsExportingPng(false);
    }
  }

  return (
    <main className="appShell">
      <aside className="sidebar" aria-label="목표 트리">
        <div className="brand">
          <div className="brandMark">M</div>
          <div>
            <p>목표 보드</p>
            <h1>만다라트</h1>
          </div>
          <button
            className="themeToggle"
            type="button"
            aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}
          </button>
        </div>

        <div className="storageBadge" data-mode={storageMode}>
          {storageMode === "cloud" ? "클라우드에 자동 저장" : storageMode === "local" ? "이 기기에만 저장" : "불러오는 중"}
        </div>

        <section className="authPanel" aria-label="계정">
          {authSession ? (
            <div className="authSignedIn">
              <p>{authSession.user.email}</p>
              <button className="miniButton" type="button" onClick={signOut}>
                <LogOut aria-hidden="true" size={15} />
                로그아웃
              </button>
            </div>
          ) : (
            <form className="authForm" noValidate onSubmit={handleSubmit(signIn)}>
              <p className="sectionLabel">로그인</p>
              <div className="field">
                <input
                  type="email"
                  placeholder="이메일"
                  autoComplete="email"
                  aria-invalid={authErrors.email ? true : undefined}
                  {...register("email")}
                />
                {authErrors.email ? <p className="fieldError">{authErrors.email.message}</p> : null}
              </div>
              <div className="field">
                <input
                  type="password"
                  placeholder="비밀번호 (8자 이상)"
                  autoComplete="current-password"
                  aria-invalid={authErrors.password ? true : undefined}
                  {...register("password")}
                />
                {authErrors.password ? <p className="fieldError">{authErrors.password.message}</p> : null}
              </div>
              {authError ? <p className="authError">{authError}</p> : null}
              <div className="authActions">
                <button className="primaryButton" type="submit" disabled={isAuthBusy}>
                  <LogIn aria-hidden="true" size={15} />
                  로그인
                </button>
                <button className="secondaryButton" type="button" disabled={isAuthBusy} onClick={handleSubmit(signUp)}>
                  가입
                </button>
              </div>
            </form>
          )}
        </section>

        <p className="sectionLabel">목표 트리</p>
        <div className="goalTree">
          {goals
            .filter((goal) => goal.parentId === null)
            .map((goal) => (
              <TreeNode
                key={goal.id}
                goal={goal}
                goals={goals}
                currentGoalId={currentGoal.id}
                onSelect={(id) => {
                  setCurrentGoalId(id);
                  setSelectedGoalId(id);
                }}
              />
            ))}
        </div>

        <button className="softButton" type="button" onClick={resetBoard}>
          <RotateCcw aria-hidden="true" size={15} />
          초기화
        </button>
      </aside>

      <div className="contentSurface">
        <section className="workspace" onClick={handleWorkspaceClick}>
          <header className="hero">
            <div>
              <p className="eyebrow">오늘의 보드</p>
              <h2>{currentGoal.title}</h2>
              <nav className="breadcrumb" aria-label="현재 경로">
                {pathOf(goals, currentGoal.id).map((goal) => (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => {
                      setCurrentGoalId(goal.id);
                      setSelectedGoalId(goal.id);
                    }}
                  >
                    {goal.title}
                  </button>
                ))}
              </nav>
            </div>
            <div className="heroStats">
              <span>목표 {goals.length}개</span>
              <strong>{currentProgress}%</strong>
            </div>
          </header>

          <div ref={boardRef} className={`shareFrame ${isExportingPng ? "isExporting" : ""}`}>
            <div className="shareFrameHeader" aria-hidden={!isExportingPng}>
              <div>
                <p>만다라트</p>
                <h2>{currentGoal.title}</h2>
              </div>
              <span>{SHARE_DATE_FORMATTER.format(new Date())}</span>
            </div>
            <div className="board" aria-label="만다라트 보드">
            {boardItems.map((goal, index) => {
            const isCenter = index === 4;
            const slot = index > 4 ? index - 1 : index;

            if (!goal) {
              return (
                <button
                  key={`empty-${slot}`}
                  className={`goalCard emptyCard ${dragOverSlot === slot ? "dropTarget" : ""}`}
                  type="button"
                  onClick={() => createGoal(slot)}
                  onDragOver={(event) => {
                    if (!dragGoalId) return;
                    event.preventDefault();
                    setDragOverSlot(slot);
                  }}
                  onDragLeave={() => setDragOverSlot((prev) => (prev === slot ? null : prev))}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleSlotDrop(slot);
                  }}
                >
                  <Plus aria-hidden="true" />
                  <h3>새 목표</h3>
                  <p>이 칸에 목표를 추가합니다.</p>
                </button>
              );
            }

            return (
              <div
                key={goal.id}
                className={`goalCard ${isCenter ? "centerCard" : ""} ${selectedGoal.id === goal.id && !isCenter ? "selected" : ""} ${
                  dragGoalId === goal.id ? "isDragging" : ""
                } ${!isCenter && dragOverSlot === slot ? "dropTarget" : ""}`}
                role="button"
                tabIndex={0}
                draggable={!isCenter}
                onDragStart={(event) => {
                  if (isCenter) return;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", goal.id);
                  setDragGoalId(goal.id);
                }}
                onDragEnd={() => {
                  setDragGoalId(null);
                  setDragOverSlot(null);
                }}
                onDragOver={(event) => {
                  if (isCenter || !dragGoalId || dragGoalId === goal.id) return;
                  event.preventDefault();
                  setDragOverSlot(slot);
                }}
                onDragLeave={() => {
                  if (!isCenter) setDragOverSlot((prev) => (prev === slot ? null : prev));
                }}
                onDrop={(event) => {
                  if (isCenter) return;
                  event.preventDefault();
                  handleSlotDrop(slot);
                }}
                onClick={() => {
                  setSelectedGoalId(goal.id);
                }}
                onDoubleClick={() => {
                  setCurrentGoalId(goal.id);
                  setSelectedGoalId(goal.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setCurrentGoalId(goal.id);
                    setSelectedGoalId(goal.id);
                  }
                }}
              >
                {goal.imageUrl ? <span className="cardImage" style={{ backgroundImage: `url(${goal.imageUrl})` }} /> : null}
                <span className="cardQuickActions" aria-label={`${goal.title} 빠른 작업`}>
                  {canMutateGoalDirectly(goals, goal) ? (
                    <button
                      type="button"
                      aria-label={goal.status === "done" ? `${goal.title} 완료 해제` : `${goal.title} 완료`}
                      data-active={goal.status === "done"}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleGoalDone(goal, { x: event.clientX, y: event.clientY });
                      }}
                    >
                      <Check aria-hidden="true" size={14} />
                    </button>
                  ) : null}
                  {canMutateGoalDirectly(goals, goal) && goal.parentId !== null ? (
                    <button
                      type="button"
                      aria-label={`${goal.title} 삭제`}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeGoal(goal);
                      }}
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  ) : null}
                </span>
                <span className="cardTop">
                  <small>{isCenter ? "핵심" : `칸 ${goal.slot + 1}`}</small>
                  <em data-status={goal.status}>{statusLabels[goal.status]}</em>
                </span>
                <span className="cardBody">
                  <h3>{goal.title}</h3>
                  <p>{goal.description || `${priorityLabels[goal.priority]} 우선순위`}</p>
                </span>
                <span className="cardMeta">
                  <small>하위 {childrenOf(goals, goal.id).length}개</small>
                  <span className="meter">
                    <span style={{ width: `${progressOf(goals, goal.id)}%` }} />
                  </span>
                  <small>{progressOf(goals, goal.id)}%</small>
                </span>
              </div>
            );
            })}
            </div>
          </div>
        </section>

        <aside className={`inspector ${isPanelOpen ? "isOpen" : ""}`} aria-label="목표 편집">
        <div
          className="inspectorHeader"
          role="button"
          tabIndex={0}
          aria-expanded={isPanelOpen}
          onClick={() => setIsPanelOpen((prev) => !prev)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setIsPanelOpen((prev) => !prev);
            }
          }}
        >
          <div>
            <p className="eyebrow">상세 편집</p>
            <h2>{selectedGoal.title}</h2>
          </div>
          <span>{selectedProgress}%</span>
          <ChevronUp aria-hidden="true" className="panelChevron" size={18} />
        </div>

        <label>
          제목
          <input value={selectedGoal.title} onChange={(event) => patchGoal(selectedGoal.id, { title: event.target.value })} />
        </label>

        <label>
          설명
          <textarea
            rows={3}
            value={selectedGoal.description}
            onChange={(event) => patchGoal(selectedGoal.id, { description: event.target.value })}
          />
        </label>

        <div className="fieldGrid">
          <label>
            상태
            <select
              value={selectedGoal.status}
              onChange={(event) => patchGoal(selectedGoal.id, { status: event.target.value as GoalStatus })}
            >
              <option value="todo">예정</option>
              <option value="doing">진행 중</option>
              <option value="done">완료</option>
            </select>
          </label>

          <label>
            우선순위
            <select
              value={selectedGoal.priority}
              onChange={(event) => patchGoal(selectedGoal.id, { priority: event.target.value as GoalPriority })}
            >
              <option value="low">낮음</option>
              <option value="medium">보통</option>
              <option value="high">높음</option>
            </select>
          </label>
        </div>

        <label>
          기한
          <input
            type="date"
            value={selectedGoal.dueDate ?? ""}
            onChange={(event) => patchGoal(selectedGoal.id, { dueDate: event.target.value || null })}
          />
        </label>

        <div className="actionRow">
          <button className="primaryButton" type="button" disabled={isSaving}>
            <Save aria-hidden="true" size={17} />
            {isSaving ? "저장 중" : "자동 저장"}
          </button>
          <button
            className="secondaryButton"
            type="button"
            disabled={selectedGoal.id === currentGoal.id}
            onClick={() => setCurrentGoalId(selectedGoal.id)}
          >
            하위 보드
            <ChevronRight aria-hidden="true" size={17} />
          </button>
        </div>

        <details className="exportPanel" aria-label="내보내기">
          <summary>
            <p className="eyebrow">내보내기</p>
            <h3>보드 저장</h3>
          </summary>
          <div className="exportActions">
            <button className="secondaryButton" type="button" onClick={exportJson}>
              <FileJson aria-hidden="true" size={17} />
              JSON
            </button>
            <button className="secondaryButton" type="button" onClick={() => importInputRef.current?.click()}>
              <FileUp aria-hidden="true" size={17} />
              JSON 복원
            </button>
            <button className="secondaryButton" type="button" onClick={exportCsv}>
              <TableProperties aria-hidden="true" size={17} />
              CSV
            </button>
            <button className="primaryButton" type="button" onClick={exportPng} disabled={isExportingPng}>
              <Download aria-hidden="true" size={17} />
              {isExportingPng ? "저장 중" : "PNG"}
            </button>
            <input ref={importInputRef} type="file" accept="application/json,.json" onChange={importJson} hidden />
          </div>
        </details>
        </aside>
      </div>
    </main>
  );
}

function TreeNode({
  goal,
  goals,
  currentGoalId,
  depth = 0,
  onSelect
}: {
  goal: Goal;
  goals: Goal[];
  currentGoalId: string;
  depth?: number;
  onSelect: (id: string) => void;
}) {
  const kids = childrenOf(goals, goal.id);
  const [isOpen, setIsOpen] = useState(false);
  const isDone = goal.status === "done";

  return (
    <>
      <div
        className={`treeNode ${goal.id === currentGoalId ? "active" : ""} ${isDone ? "done" : ""}`}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        {kids.length ? (
          <button
            className={`treeToggle ${isOpen ? "open" : ""}`}
            type="button"
            aria-expanded={isOpen}
            aria-label={isOpen ? `${goal.title} 하위 목표 접기` : `${goal.title} 하위 목표 펼치기`}
            onClick={() => setIsOpen((prev) => !prev)}
          >
            <ChevronRight aria-hidden="true" size={13} />
          </button>
        ) : (
          <span className="treeLeaf">{isDone ? <Check aria-hidden="true" size={13} /> : null}</span>
        )}
        <button className="treeLabel" type="button" onClick={() => onSelect(goal.id)}>
          <strong>{goal.title}</strong>
          <small>
            {progressOf(goals, goal.id)}% · 하위 {kids.length}개
          </small>
        </button>
      </div>
      {isOpen
        ? kids.map((child) => (
            <TreeNode
              key={child.id}
              goal={child}
              goals={goals}
              currentGoalId={currentGoalId}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))
        : null}
    </>
  );
}
