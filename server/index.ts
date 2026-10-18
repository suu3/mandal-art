import { Hono } from 'hono';
import { z } from 'zod';
import { createAuth, authReady, type Env } from './auth';
import { readBoard, replaceBoard } from './boards';
import { MAX_BYTES, validateGoals } from '../src/domain/goals';

const app = new Hono<{ Bindings: Env; Variables: { owner: string } }>();
app.use('/api/*', async (c, next) => {
  c.header('Cache-Control', 'no-store'); c.header('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const expected = c.env.BETTER_AUTH_URL ? new URL(c.env.BETTER_AUTH_URL).origin : new URL(c.req.url).origin;
    if (c.req.header('Origin') !== expected) return c.json({ error: '허용되지 않은 요청입니다.' }, 403);
  }
  await next();
});
app.get('/api/config', c => c.json({ githubLogin: authReady(c.env) }));
app.on(['GET', 'POST'], '/api/auth/*', c => {
  if (!authReady(c.env)) return c.req.path === '/api/auth/get-session' ? c.json(null) : c.json({ error: '로그인 준비 중입니다. 기기 저장으로 이용해주세요.' }, 503);
  return createAuth(c.env).handler(c.req.raw);
});
app.use('/api/board', async (c, next) => {
  if (!authReady(c.env)) return c.json({ error: '로그인이 필요합니다.' }, 401);
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: '로그인이 필요합니다.' }, 401);
  c.set('owner', session.user.id); await next();
});
app.get('/api/board', async c => c.json(await readBoard(c.env.DB, c.get('owner'))));
app.put('/api/board', async c => {
  if (!c.req.header('Content-Type')?.toLowerCase().startsWith('application/json')) return c.json({ error: 'JSON 형식이 필요합니다.' }, 415);
  const length = Number(c.req.header('Content-Length') ?? 0);
  if (length > MAX_BYTES) return c.json({ error: '요청은 256KiB 이하여야 합니다.' }, 413);
  const reader = c.req.raw.body?.getReader();
  if (!reader) return c.json({ error: '본문이 필요합니다.' }, 400);
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    bytes += value.length;
    if (bytes > MAX_BYTES) { await reader.cancel(); return c.json({ error: '요청은 256KiB 이하여야 합니다.' }, 413); }
    chunks.push(value);
  }
  const buffer = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  let goals; let expectedRevision;
  try {
    const payload = z.object({ expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1), goals: z.unknown() }).parse(JSON.parse(new TextDecoder().decode(buffer)));
    goals = validateGoals(payload.goals); expectedRevision = payload.expectedRevision;
  } catch { return c.json({ error: '목표 형식이 올바르지 않습니다. 원본 백업을 확인해주세요.' }, 400); }
  const board = await replaceBoard(c.env.DB, c.get('owner'), expectedRevision, goals);
  return board ? c.json(board) : c.json({ error: '다른 창에서 변경되었습니다. 백업 후 다시 불러와주세요.' }, 409);
});
app.all('/api/*', c => c.json({ error: '찾을 수 없는 API입니다.' }, 404));
app.onError((error, c) => {
  console.error('API request failed:', error.name);
  return c.json({ error: '서버 요청에 실패했습니다. 잠시 후 다시 시도해주세요.' }, 500);
});
app.all('*', c => c.env.ASSETS ? c.env.ASSETS.fetch(c.req.raw) : c.notFound());
export default app;
