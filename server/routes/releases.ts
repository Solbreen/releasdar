import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.js';

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
});

export function registerReleaseRoutes(app: FastifyInstance, { db }: AppDeps): void {
  app.get('/api/products', () => db.prepare('SELECT p.id, p.name, COALESCE(a.full_name, p.manager) AS manager, p.manager_id AS managerId, p.description, p.color, p.status FROM products p LEFT JOIN accounts a ON a.id=p.manager_id ORDER BY p.id').all());
  app.post('/api/products', (request, reply) => {
    const result = productSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ error: 'Заполните обязательные поля продукта' });
    const p = result.data;
    const manager = db.prepare("SELECT full_name FROM accounts WHERE id = ? AND role = 'rp'").get(p.managerId) as { full_name: string } | undefined;
    if (!manager) return reply.code(400).send({ error: 'Выберите ответственного с ролью РП' });
    const inserted = db.prepare('INSERT INTO products (name, manager, manager_id, description, color) VALUES (?, ?, ?, ?, ?)').run(p.name, manager.full_name, p.managerId, p.description, p.color);
    return reply.code(201).send({ id: inserted.lastInsertRowid });
  });
  app.put<{ Params: { id: string } }>('/api/products/:id', (request, reply) => {
    const result = productSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ error: 'Заполните обязательные поля продукта' });
    const p = result.data;
    const manager = db.prepare("SELECT full_name FROM accounts WHERE id = ? AND role = 'rp'").get(p.managerId) as { full_name: string } | undefined;
    if (!manager) return reply.code(400).send({ error: 'Выберите ответственного с ролью РП' });
    const updated = db.prepare('UPDATE products SET name=?, manager=?, manager_id=?, description=?, color=?, status=COALESCE(?, status) WHERE id=?').run(p.name, manager.full_name, p.managerId, p.description, p.color, p.status ?? null, request.params.id);
    return updated.changes ? { ok: true } : reply.code(404).send({ error: 'Продукт не найден' });
  });
  app.delete<{ Params: { id: string } }>('/api/products/:id', (request, reply) => {
    const remove = db.transaction(() => { db.prepare('DELETE FROM releases WHERE product_id=?').run(request.params.id); return db.prepare('DELETE FROM products WHERE id=?').run(request.params.id); });
    return remove().changes ? { ok: true } : reply.code(404).send({ error: 'Продукт не найден' });
  });
  app.delete<{ Params: { id: string } }>('/api/releases/:id', (request, reply) => db.prepare('DELETE FROM releases WHERE id=?').run(request.params.id).changes ? { ok: true } : reply.code(404).send({ error: 'Релиз не найден' }));
  app.get('/api/releases', () => db.prepare('SELECT id, product_id AS productId, date, description FROM releases ORDER BY date DESC, id DESC').all());
  app.post('/api/releases', (request, reply) => {
    const result = releaseSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ error: 'Выберите продукт и дату с 2026 по 2036 год' });
    const r = result.data;
    if (!db.prepare('SELECT id FROM products WHERE id=?').get(r.productId)) return reply.code(400).send({ error: 'Продукт не найден' });
    const inserted = db.prepare('INSERT INTO releases (product_id, date, description) VALUES (?, ?, ?)').run(r.productId, r.date, r.description);
    return reply.code(201).send({ id: inserted.lastInsertRowid });
  });
}
