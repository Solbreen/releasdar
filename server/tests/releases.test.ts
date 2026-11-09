import { afterEach, describe, expect, it } from 'vitest';
import { closeTestApp, createTestApp, type TestContext } from './helpers.js';

describe('общий календарь релизов', () => {
  let ctx: TestContext;
  afterEach(async () => { if (ctx) await closeTestApp(ctx); });

  it('сохраняет продукты и релизы, проверяет обязательные поля и даты', async () => {
    ctx = await createTestApp();
    const product = { name: 'Сервис', manager: 'Иван Иванов', description: 'Описание', color: '#3a86ff' };
    const invalid = await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/products', payload: { ...product, manager: '  ' } });
    expect(invalid.statusCode).toBe(400);
    const created = await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/products', payload: product });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as number;
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'PUT', url: `/api/products/${id}`, payload: { ...product, name: 'Новый сервис' } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/releases', payload: { productId: id, date: '2027-02-30', description: '' } })).statusCode).toBe(400);
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/releases', payload: { productId: 999, date: '2027-02-28', description: '' } })).statusCode).toBe(400);
    for (const date of ['2026-01-01', '2036-12-31']) {
      expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/releases', payload: { productId: id, date, description: 'Релиз' } })).statusCode).toBe(201);
    }
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/releases', payload: { productId: id, date: '2037-01-01', description: '' } })).statusCode).toBe(400);
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'GET', url: '/api/products' })).json()[0].name).toBe('Новый сервис');
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'GET', url: '/api/releases' })).json().map((r: {date: string}) => r.date)).toEqual(['2036-12-31', '2026-01-01']);
    expect((await ctx.app.inject({ headers: { cookie: ctx.cookie }, method: 'POST', url: '/api/users', payload: {} })).statusCode).toBe(404);
  });
});
