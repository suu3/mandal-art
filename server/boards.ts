import { newRoot, type Goal } from '../src/domain/goals';
type Row = { revision: number; snapshot: string };
export async function readBoard(db: D1Database, owner: string) {
  await db.prepare('INSERT OR IGNORE INTO board (owner_id,revision,snapshot) VALUES (?,0,?)').bind(owner, JSON.stringify([newRoot()])).run();
  const row = await db.prepare('SELECT revision,snapshot FROM board WHERE owner_id = ?').bind(owner).first<Row>();
  if (!row) throw new Error('Board not found');
  return { revision: row.revision, goals: JSON.parse(row.snapshot) as Goal[] };
}
export async function replaceBoard(db: D1Database, owner: string, expectedRevision: number, goals: Goal[]) {
  await db.prepare('INSERT OR IGNORE INTO board (owner_id,revision,snapshot) VALUES (?,0,?)').bind(owner, JSON.stringify([newRoot()])).run();
  const result = await db.prepare('UPDATE board SET snapshot = ?, revision = revision + 1 WHERE owner_id = ? AND revision = ?').bind(JSON.stringify(goals), owner, expectedRevision).run();
  return result.meta.changes === 1 ? { revision: expectedRevision + 1, goals } : null;
}
