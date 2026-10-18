import type { Goal } from '../domain/goals';
export type Board = { revision: number; goals: Goal[] };
export type SaveState = 'saving' | 'saved' | 'error' | 'conflict';
export class SaveQueue {
  private pending: Goal[] | null = null;
  private task: Promise<void> = Promise.resolve();
  private running = false;
  private blocked = false;
  private conflict = false;
  private disposed = false;
  constructor(public revision: number, private send: (goals: Goal[], revision: number) => Promise<Board>, private notify: (state: SaveState, board?: Board) => void) {}
  save(goals: Goal[]) { if (this.disposed) return; this.pending = goals; this.start(); }
  retry() { if (this.conflict || this.disposed) return; this.blocked = false; this.start(); }
  dispose() { this.disposed = true; this.pending = null; }
  idle() { return this.task; }
  private start() {
    if (this.running || this.blocked || this.disposed || !this.pending) return;
    this.running = true;
    this.task = this.drain();
  }
  private async drain() {
    while (this.pending && !this.disposed && !this.blocked) {
      const goals = this.pending; this.pending = null; this.notify('saving');
      try {
        const board = await this.send(goals, this.revision);
        if (this.disposed) break;
        this.revision = board.revision;
        this.notify(this.pending ? 'saving' : 'saved', board);
      } catch (error) {
        if (this.disposed) break;
        this.pending ??= goals; this.blocked = true;
        this.conflict = (error as { status?: number }).status === 409;
        this.notify(this.conflict ? 'conflict' : 'error');
      }
    }
    this.running = false;
  }
}
export async function getBoard(signal?: AbortSignal): Promise<Board> {
  const response = await fetch('/api/board', { signal, cache: 'no-store' });
  if (!response.ok) throw Object.assign(new Error('서버에서 목표를 불러오지 못했습니다.'), { status: response.status });
  return response.json();
}
export async function putBoard(goals: Goal[], expectedRevision: number): Promise<Board> {
  const response = await fetch('/api/board', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goals, expectedRevision }) });
  if (!response.ok) throw Object.assign(new Error('목표를 저장하지 못했습니다.'), { status: response.status });
  return response.json();
}
