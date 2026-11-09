import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Db } from './db.js';

type Role = 'admin' | 'rp' | 'devops';
type Identity = { login: string; role: Role; id?: number };
type Account = { id: number; login: string; password_hash: string; role: 'rp' | 'devops' };
const lifetime = 12 * 60 * 60 * 1000;
const key = (value: string): string => value.trim().normalize('NFKC').toLocaleLowerCase('ru');
const hash = (value: string): Buffer => createHash('sha256').update(value).digest();
const equal = (a: string, b: string): boolean => timingSafeEqual(hash(a), hash(b));
const makePassword = (password: string): string => { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; };
const verifyPassword = (password: string, stored: string): boolean => { const [salt, hex] = stored.split(':'); if (!salt || !hex || !/^[a-f0-9]{128}$/.test(hex)) return false; return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hex, 'hex')); };
const accountSchema = z.object({ login: z.string().trim().min(1).max(100), fullName: z.string().trim().min(1).max(200), password: z.string().min(8).max(256), role: z.enum(['rp', 'devops']) });
const updateSchema = z.object({ fullName: z.string().trim().min(1).max(200), role: z.enum(['rp', 'devops']), password: z.string().min(8).max(256).optional() });

export function registerAuth(app: FastifyInstance, login: string, password: string, db: Db): (request: FastifyRequest) => Role | undefined {
  const sessions = new Map<string, { expires: number; identity: Identity }>();
  const attempts = new Map<string, { count: number; until: number }>();
  const cookie = (r: FastifyRequest): string => /(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/.exec(r.headers.cookie ?? '')?.[1] ?? '';
  const current = (r: FastifyRequest): Identity | undefined => { const token = cookie(r); const session = sessions.get(token); if (!session || session.expires <= Date.now()) { sessions.delete(token); return undefined; } return session.identity; };
  const invalidate = (id: number): void => { for (const [token, session] of sessions) if (session.identity.id === id) sessions.delete(token); };
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0] ?? '';
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.headers.origin) {
      try { if (new URL(request.headers.origin).host !== request.headers.host) return reply.code(403).send({ error: 'Недопустимый источник запроса' }); } catch { return reply.code(403).send({ error: 'Недопустимый источник запроса' }); }
    }
    if (!path.startsWith('/api/') || path === '/api/health' || path === '/api/auth/login') return;
    const user = current(request);
    if (!user) return reply.code(401).send({ error: 'Требуется вход' });
    if (path.startsWith('/api/accounts') && user.role !== 'admin') return reply.code(403).send({ error: 'Недостаточно прав' });
    if (request.method === 'DELETE' && (path.startsWith('/api/products/') || path.startsWith('/api/releases/')) && user.role !== 'admin') return reply.code(403).send({ error: 'Недостаточно прав' });
    if ((path === '/api/products' || path.startsWith('/api/products/') || path === '/api/releases') && request.method !== 'GET' && request.method !== 'HEAD' && user.role === 'devops') return reply.code(403).send({ error: 'Недостаточно прав' });
  });
  app.post('/api/auth/login', { bodyLimit: 4096 }, async (request, reply) => {
    const now = Date.now(); for (const [k, a] of attempts) if (a.until <= now) attempts.delete(k);
    const prev = attempts.get(request.ip); if (prev && prev.count >= 10) return reply.code(429).send({ error: 'Слишком много попыток. Попробуйте позже.' });
    const body = request.body as { login?: unknown; password?: unknown } | null;
    let identity: Identity | undefined;
    if (typeof body?.login === 'string' && typeof body.password === 'string' && body.login.length <= 100 && body.password.length <= 256) {
      const normalized = key(body.login);
      if (equal(normalized, key(login)) && equal(body.password, password)) identity = { login, role: 'admin' };
      else if (!equal(normalized, key(login))) { const account = db.prepare('SELECT id, login, password_hash, role FROM accounts WHERE login_key = ?').get(normalized) as Account | undefined; if (account && verifyPassword(body.password, account.password_hash)) identity = { id: account.id, login: account.login, role: account.role }; }
    }
    if (!identity) { attempts.set(request.ip, { count: (prev?.count ?? 0) + 1, until: prev?.until ?? now + 15 * 60 * 1000 }); return reply.code(401).send({ error: 'Неверный логин или пароль' }); }
    attempts.delete(request.ip); for (const [token, session] of sessions) if (session.expires <= now) sessions.delete(token);
    sessions.delete(cookie(request)); const token = randomBytes(32).toString('hex'); sessions.set(token, { expires: now + lifetime, identity });
    const secure = request.headers['x-forwarded-proto'] === 'https' || request.protocol === 'https';
    reply.header('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${lifetime / 1000}${secure ? '; Secure' : ''}`); return identity;
  });
  app.get('/api/auth/me', (request) => current(request));
  app.post('/api/auth/logout', (request, reply) => { sessions.delete(cookie(request)); reply.header('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'); return { ok: true }; });
  app.get('/api/accounts', () => db.prepare('SELECT id, login, role, full_name AS fullName FROM accounts ORDER BY id').all());
  app.get('/api/project-managers', () => db.prepare("SELECT id, full_name AS fullName FROM accounts WHERE role = 'rp' ORDER BY full_name, id").all());
  app.delete<{ Params: { id: string } }>('/api/accounts/:id', (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return reply.code(400).send({ error: 'Некорректный идентификатор' });
    const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    if (!result.changes) return reply.code(404).send({ error: 'Пользователь не найден' });
    invalidate(id);
    return { ok: true };
  });
  app.post('/api/accounts', (request, reply) => {
    const parsed = accountSchema.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: 'Укажите логин, роль и пароль не менее 8 символов' });
    const data = parsed.data; const normalized = key(data.login);
    if (normalized === key(login) || db.prepare('SELECT id FROM accounts WHERE login_key = ?').get(normalized)) return reply.code(409).send({ error: 'Логин уже занят' });
    const result = db.prepare('INSERT INTO accounts (login, login_key, password_hash, role, created_at, full_name) VALUES (?, ?, ?, ?, ?, ?)').run(data.login, normalized, makePassword(data.password), data.role, new Date().toISOString(), data.fullName);
    return reply.code(201).send({ id: result.lastInsertRowid });
  });
  app.patch<{ Params: { id: string } }>('/api/accounts/:id', (request, reply) => {
    const parsed = updateSchema.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: 'Некорректная роль или пароль' });
    const id = Number(request.params.id); if (!Number.isSafeInteger(id) || id < 1) return reply.code(400).send({ error: 'Некорректный идентификатор' });
    if (!db.prepare('SELECT id FROM accounts WHERE id = ?').get(id)) return reply.code(404).send({ error: 'Пользователь не найден' });
    if (parsed.data.password !== undefined) db.prepare('UPDATE accounts SET role=?, password_hash=?, full_name=? WHERE id=?').run(parsed.data.role, makePassword(parsed.data.password), parsed.data.fullName, id);
    else db.prepare('UPDATE accounts SET role=?, full_name=? WHERE id=?').run(parsed.data.role, parsed.data.fullName, id);
    invalidate(id); return { ok: true };
  });
  return (request) => current(request)?.role;
}
