import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const lifetime = 12 * 60 * 60 * 1000;
const hash = (value: string): Buffer => createHash('sha256').update(value).digest();
export function registerAuth(app: FastifyInstance, login: string, password: string): void {
  const sessions = new Map<string, number>();
  const attempts = new Map<string, { count: number; until: number }>();
  const cookie = (request: FastifyRequest): string => /(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.cookie ?? '')?.[1] ?? '';
  const valid = (request: FastifyRequest): boolean => {
    const token = cookie(request); const expiry = sessions.get(token);
    if (!expiry || expiry <= Date.now()) { sessions.delete(token); return false; }
    return true;
  };
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0];
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.headers.origin) {
      try { if (new URL(request.headers.origin).host !== request.headers.host) return reply.code(403).send({ error: 'Недопустимый источник запроса' }); }
      catch { return reply.code(403).send({ error: 'Недопустимый источник запроса' }); }
    }
    if (path?.startsWith('/api/') && path !== '/api/health' && path !== '/api/auth/login' && !valid(request)) return reply.code(401).send({ error: 'Требуется вход' });
  });
  app.post('/api/auth/login', { bodyLimit: 4096 }, async (request, reply) => {
    const now = Date.now();
    for (const [key, attempt] of attempts) if (attempt.until <= now) attempts.delete(key);
    const previous = attempts.get(request.ip);
    if (previous && previous.count >= 10) return reply.code(429).send({ error: 'Слишком много попыток. Попробуйте позже.' });
    const body = request.body as { login?: unknown; password?: unknown } | null;
    if (typeof body?.login !== 'string' || typeof body.password !== 'string' || !timingSafeEqual(hash(body.login.trim().toLocaleLowerCase('ru')), hash(login.trim().toLocaleLowerCase('ru'))) || !timingSafeEqual(hash(body.password), hash(password))) {
      attempts.set(request.ip, { count: (previous?.count ?? 0) + 1, until: previous?.until ?? now + 15 * 60 * 1000 });
      return reply.code(401).send({ error: 'Неверный логин или пароль' });
    }
    attempts.delete(request.ip);
    for (const [key, expiry] of sessions) if (expiry <= Date.now()) sessions.delete(key);
    sessions.delete(cookie(request));
    const token = randomBytes(32).toString('hex'); sessions.set(token, Date.now() + lifetime);
    const secure = request.headers['x-forwarded-proto'] === 'https' || request.protocol === 'https';
    reply.header('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${lifetime / 1000}${secure ? '; Secure' : ''}`);
    return { login, role: 'admin' };
  });
  app.get('/api/auth/me', () => ({ login, role: 'admin' }));
  app.post('/api/auth/logout', (request, reply) => { sessions.delete(cookie(request)); reply.header('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'); return { ok: true }; });
}
