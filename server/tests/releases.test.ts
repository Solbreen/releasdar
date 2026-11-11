import { afterEach, describe, expect, it } from 'vitest';
import { closeTestApp, createTestApp, type TestContext } from './helpers.js';

describe('общий календарь релизов', () => {
  let ctx: TestContext;
  afterEach(async () => { if (ctx) await closeTestApp(ctx); });

  it('сохраняет продукты и релизы, проверяет обязательные поля и даты', async () => {
    ctx = await createTestApp();
    ctx.db.prepare("INSERT INTO accounts (login, login_key, password_hash, role, created_at, full_name) VALUES ('rp', 'rp', 'x', 'rp', '2026', 'Иван Иванов')").run();
    const product = { name: 'Сервис', managerId: 1, description: 'Описание', color: '#3a86ff' };
    const invalid = await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/products', payload: { ...product, managerId: 0 } });
    expect(invalid.statusCode).toBe(400);
    const created = await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/products', payload: product });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as number;
    expect((await ctx.app.inject({ method: 'GET', url: '/api/products', headers: { cookie: ctx.cookie } })).json()[0].status).toBe('active');
    for (const status of ['archived', 'active']) {
      expect((await ctx.app.inject({ method: 'PUT', url: `/api/products/${id}`, headers: { cookie: ctx.cookie }, payload: { ...product, status } })).statusCode).toBe(200);
      expect((await ctx.app.inject({ method: 'GET', url: '/api/products', headers: { cookie: ctx.cookie } })).json()[0].status).toBe(status);
    }
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'PUT', url: `/api/products/${id}`, payload: { ...product, name: 'Новый сервис' } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/releases', payload: { productId: id, date: '2027-02-30', description: '' } })).statusCode).toBe(400);
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/releases', payload: { productId: 999, date: '2027-02-28', description: '' } })).statusCode).toBe(400);
    for (const date of ['2026-01-01', '2036-12-31']) {
      expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/releases', payload: { productId: id, date, description: 'Релиз', environment: 'Test', releaseType: '' } })).statusCode).toBe(201);
    }
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/releases', payload: { productId: id, date: '2037-01-01', description: '' } })).statusCode).toBe(400);
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'GET', url: '/api/products' })).json()[0].name).toBe('Новый сервис');
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'GET', url: '/api/releases' })).json().map((r: {date: string}) => r.date)).toEqual(['2036-12-31', '2026-01-01']);
    const releaseId = (await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'GET', url: '/api/releases' })).json()[0].id;
    for (const date of ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-03', '2026-11-04', '2026-12-31']) {
      const payload = { productId: id, date, description: '', environment: 'Prod', releaseType: '' };
      expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/releases', payload })).statusCode).toBe(400);
      expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'PUT', url: `/api/releases/${releaseId}`, payload })).statusCode).toBe(400);
    }
    for (const date of ['2026-11-09', '2026-11-12']) {
      expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'PUT', url: `/api/releases/${releaseId}`, payload: { productId: id, date, description: '', environment: 'Prod', releaseType: '' } })).statusCode).toBe(200);
    }
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'DELETE', url: `/api/releases/${releaseId}` })).statusCode).toBe(200);
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'DELETE', url: `/api/products/${id}` })).statusCode).toBe(200);
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'GET', url: '/api/releases' })).json()).toEqual([]);
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/users', payload: {} })).statusCode).toBe(404);
  });
});
