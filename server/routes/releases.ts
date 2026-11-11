import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { isHoliday } from '../../shared/holidays.js';

const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  managerId: z.number().int().positive(),
  description: z.string().max(10000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  status: z.enum(['active', 'archived']).optional(),
});
const releaseSchema = z.object({
  productId: z.number().int().positive(),
  date: z.iso.date().refine((date) => date >= '2026-01-01' && date <= '2036-12-31'),
  description: z.string().max(10000),
  environment: z.enum(['Dev', 'Test', 'Prod']),
  releaseType: z.string().max(200).default(''),
});

function prohibited(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`);
  const weekday = day.getUTCDay();
  day.setUTCDate(day.getUTCDate() + 1);
  return weekday === 0 || weekday === 5 || weekday === 6 || isHoliday(date) || isHoliday(day.toISOString().slice(0, 10));
}

export function registerReleaseRoutes(app: FastifyInstance, { db }: AppDeps, getRole: (request: FastifyRequest) => 'admin' | 'rp' | 'devops' | undefined): void {
  app.get('/api/products', () => db.prepare('SELECT p.id, p.name, COALESCE(a.full_name, p.manager) AS manager, p.manager_id AS managerId, p.description, p.color, p.status FROM products p LEFT JOIN accounts a ON a.id=p.manager_id ORDER BY p.id').all());
  app.post('/api/products', (request, reply) => {
    const result = productSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ error: 'Заполните обязательные поля проекта' });
    const p = result.data;
    const manager = db.prepare("SELECT full_name FROM accounts WHERE id = ? AND role = 'rp'").get(p.managerId) as { full_name: string } | undefined;
    if (!manager) return reply.code(400).send({ error: 'Выберите ответственного с ролью РП' });
    const inserted = db.prepare('INSERT INTO products (name, manager, manager_id, description, color) VALUES (?, ?, ?, ?, ?)').run(p.name, manager.full_name, p.managerId, p.description, p.color);
    return reply.code(201).send({ id: inserted.lastInsertRowid });
  });
  app.put<{ Params: { id: string } }>('/api/products/:id', (request, reply) => {
    const result = productSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ error: 'Заполните обязательные поля проекта' });
    const p = result.data;
    const manager = db.prepare("SELECT full_name FROM accounts WHERE id = ? AND role = 'rp'").get(p.managerId) as { full_name: string } | undefined;
    if (!manager) return reply.code(400).send({ error: 'Выберите ответственного с ролью РП' });
    const updated = db.prepare('UPDATE products SET name=?, manager=?, manager_id=?, description=?, color=?, status=COALESCE(?, status) WHERE id=?').run(p.name, manager.full_name, p.managerId, p.description, p.color, p.status ?? null, request.params.id);
    return updated.changes ? { ok: true } : reply.code(404).send({ error: 'Проект не найден' });
  });
  app.delete<{ Params: { id: string } }>('/api/products/:id', (request, reply) => {
    const remove = db.transaction(() => { db.prepare('DELETE FROM releases WHERE product_id=?').run(request.params.id); return db.prepare('DELETE FROM products WHERE id=?').run(request.params.id); });
    return remove().changes ? { ok: true } : reply.code(404).send({ error: 'Проект не найден' });
  });
  app.delete<{ Params: { id: string } }>('/api/releases/:id', (request, reply) => db.prepare('DELETE FROM releases WHERE id=?').run(request.params.id).changes ? { ok: true } : reply.code(404).send({ error: 'Релиз не найден' }));
  app.get('/api/releases', () => db.prepare('SELECT id, product_id AS productId, date, description, status, environment, release_type AS releaseType FROM releases ORDER BY date DESC, id DESC').all());
  app.patch<{ Params: { id: string } }>('/api/releases/:id/status', (request, reply) => {
    const parsed = z.object({ status: z.enum(['rejected', 'in_progress', 'completed']), expectedStatus: z.enum(['planned', 'in_progress']) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Некорректный статус' });
    const { status, expectedStatus } = parsed.data;
    const role = getRole(request);
    const allowed = expectedStatus === 'planned' && status === 'rejected' ? role === 'rp' || role === 'admin' : (expectedStatus === 'planned' && status === 'in_progress') || (expectedStatus === 'in_progress' && status === 'completed') ? role === 'devops' || role === 'admin' : false;
    if (!allowed) return reply.code(403).send({ error: 'Переход недоступен' });
    const updated = db.prepare('UPDATE releases SET status=? WHERE id=? AND status=?').run(status, request.params.id, expectedStatus);
    if (!updated.changes) return reply.code(db.prepare('SELECT id FROM releases WHERE id=?').get(request.params.id) ? 409 : 404).send({ error: 'Релиз не найден или статус уже изменился' });
    return { ok: true };
  });
  app.post('/api/releases', (request, reply) => {
    const result = releaseSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ error: 'Выберите проект, стенд и дату с 2026 по 2036 год' });
    const r = result.data;
    if (r.environment === 'Prod' && prohibited(r.date)) return reply.code(400).send({ error: 'Релиз на Prod запрещён в выходной, праздник и день перед ними' });
    if (!db.prepare('SELECT id FROM products WHERE id=?').get(r.productId)) return reply.code(400).send({ error: 'Проект не найден' });
    const inserted = db.prepare('INSERT INTO releases (product_id, date, description, environment, release_type) VALUES (?, ?, ?, ?, ?)').run(r.productId, r.date, r.description, r.environment, r.releaseType);
    return reply.code(201).send({ id: inserted.lastInsertRowid });
  });
  app.put<{ Params: { id: string } }>('/api/releases/:id', (request, reply) => {
    const result = releaseSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ error: 'Заполните обязательные поля' });
    const r = result.data;
    if (r.environment === 'Prod' && prohibited(r.date)) return reply.code(400).send({ error: 'Релиз на Prod запрещён в выходной, праздник и день перед ними' });
    if (!db.prepare('SELECT id FROM products WHERE id=?').get(r.productId)) return reply.code(400).send({ error: 'Проект не найден' });
    const updated = db.prepare('UPDATE releases SET product_id=?, date=?, description=?, environment=?, release_type=? WHERE id=?').run(r.productId, r.date, r.description, r.environment, r.releaseType, request.params.id);
    return updated.changes ? { ok: true } : reply.code(404).send({ error: 'Релиз не найден' });
  });
}
