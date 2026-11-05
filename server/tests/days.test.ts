import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { UserDto } from '../../shared/types.js';
import { closeTestApp, createTestApp, errorOf, login, type TestContext } from './helpers.js';

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestApp();
});

afterEach(async () => {
  await closeTestApp(ctx);
});

async function saveDays(id: number, dates: string[], version: number) {
  return ctx.app.inject({
    method: 'PUT',
    url: `/api/users/${id}/days`,
    payload: { dates, version },
  });
}

describe('PUT /api/users/:id/days', () => {
  it('сохраняет дни и увеличивает version', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await saveDays(created.user.id, ['2027-03-01', '2027-03-02'], 0);
    expect(response.statusCode).toBe(200);
    const user = (response.json() as { user: UserDto }).user;
    expect(user.days).toEqual(['2027-03-01', '2027-03-02']);
    expect(user.version).toBe(1);
  });

  it('полностью заменяет предыдущий набор дней', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await saveDays(created.user.id, ['2027-03-01', '2027-03-02'], 0);
    const response = await saveDays(created.user.id, ['2027-08-15'], 1);
    const user = (response.json() as { user: UserDto }).user;
    expect(user.days).toEqual(['2027-08-15']);
    expect(user.version).toBe(2);
  });

  it('принимает пустой массив и очищает дни', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await saveDays(created.user.id, ['2027-03-01'], 0);
    const response = await saveDays(created.user.id, [], 1);
    expect(response.statusCode).toBe(200);
    expect((response.json() as { user: UserDto }).user.days).toEqual([]);
  });

  it('молча удаляет дубликаты', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await saveDays(
      created.user.id,
      ['2027-04-01', '2027-04-01', '2027-04-02', '2027-04-01'],
      0,
    );
    expect(response.statusCode).toBe(200);
    expect((response.json() as { user: UserDto }).user.days).toEqual(['2027-04-01', '2027-04-02']);
  });

  it('возвращает дни в отсортированном порядке независимо от порядка во входе', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await saveDays(
      created.user.id,
      ['2027-12-31', '2027-01-01', '2027-06-15'],
      0,
    );
    expect((response.json() as { user: UserDto }).user.days).toEqual([
      '2027-01-01',
      '2027-06-15',
      '2027-12-31',
    ]);
  });

  it('принимает границы года', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await saveDays(created.user.id, ['2027-01-01', '2027-12-31'], 0);
    expect(response.statusCode).toBe(200);
  });

  it.each([
    ['дата другого года (раньше)', '2026-12-31'],
    ['дата другого года (позже)', '2028-01-01'],
    ['несуществующая дата 29 февраля', '2027-02-29'],
    ['несуществующая дата 31 апреля', '2027-04-31'],
    ['13-й месяц', '2027-13-01'],
    ['нулевой день', '2027-01-00'],
    ['неверный формат', '2027-1-1'],
    ['совсем не дата', 'вчера'],
    ['пустая строка', ''],
  ])('возвращает 400 INVALID_DATE: %s', async (_label, date) => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await saveDays(created.user.id, [date], 0);
    expect(response.statusCode).toBe(400);
    expect(errorOf(response).code).toBe('INVALID_DATE');
    expect(errorOf(response).message).toMatch(/[а-яА-Я]/);
  });

  it('не сохраняет ничего, если хотя бы одна дата некорректна', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await saveDays(created.user.id, ['2027-05-05', '2027-02-30'], 0);
    expect(response.statusCode).toBe(400);
    const user = await ctx.app.inject({ method: 'GET', url: `/api/users/${created.user.id}` });
    expect((user.json() as { user: UserDto }).user.days).toEqual([]);
    expect((user.json() as { user: UserDto }).user.version).toBe(0);
  });

  it('возвращает 400 VALIDATION_ERROR, если dates не массив', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${created.user.id}/days`,
      payload: { dates: '2027-01-01', version: 0 },
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response).code).toBe('INVALID_DATE');
  });

  it('возвращает 400 VALIDATION_ERROR, если version отсутствует', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${created.user.id}/days`,
      payload: { dates: [] },
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response).code).toBe('VALIDATION_ERROR');
  });

  it('возвращает 409 VERSION_CONFLICT при устаревшей версии', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await saveDays(created.user.id, ['2027-03-01'], 0);
    const stale = await saveDays(created.user.id, ['2027-09-09'], 0);
    expect(stale.statusCode).toBe(409);
    expect(errorOf(stale).code).toBe('VERSION_CONFLICT');
  });

  it('в теле конфликта возвращает актуального пользователя', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await saveDays(created.user.id, ['2027-03-01'], 0);
    const stale = await saveDays(created.user.id, ['2027-09-09'], 0);
    const actual = errorOf(stale).user;
    expect(actual).toBeDefined();
    expect(actual).toMatchObject({
      id: created.user.id,
      version: 1,
      days: ['2027-03-01'],
      displayName: 'Иван Петров',
      firstName: 'Иван',
      lastName: 'Петров',
    });
  });

  it('при конфликте не меняет сохранённые дни', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await saveDays(created.user.id, ['2027-03-01'], 0);
    await saveDays(created.user.id, ['2027-09-09'], 0);
    const user = await ctx.app.inject({ method: 'GET', url: `/api/users/${created.user.id}` });
    expect((user.json() as { user: UserDto }).user.days).toEqual(['2027-03-01']);
    expect((user.json() as { user: UserDto }).user.version).toBe(1);
  });

  it('возвращает 409 и для версии из будущего', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await saveDays(created.user.id, ['2027-03-01'], 5);
    expect(response.statusCode).toBe(409);
    expect(errorOf(response).code).toBe('VERSION_CONFLICT');
  });

  it('возвращает 404 USER_NOT_FOUND для неизвестного пользователя', async () => {
    const response = await saveDays(31337, ['2027-03-01'], 0);
    expect(response.statusCode).toBe(404);
    expect(errorOf(response).code).toBe('USER_NOT_FOUND');
  });

  it('проверяет существование пользователя раньше версии', async () => {
    const response = await saveDays(31337, ['2027-03-01'], 99);
    expect(response.statusCode).toBe(404);
  });

  it('не затрагивает дни других пользователей', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    const second = await login(ctx.app, 'Анна', 'Смирнова');
    await saveDays(first.user.id, ['2027-03-01'], 0);
    await saveDays(second.user.id, ['2027-03-02'], 0);
    await saveDays(first.user.id, ['2027-03-03'], 1);

    const response = await ctx.app.inject({ method: 'GET', url: `/api/users/${second.user.id}` });
    expect((response.json() as { user: UserDto }).user.days).toEqual(['2027-03-02']);
  });

  it('одну и ту же дату могут занять разные пользователи', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    const second = await login(ctx.app, 'Анна', 'Смирнова');
    expect((await saveDays(first.user.id, ['2027-03-01'], 0)).statusCode).toBe(200);
    expect((await saveDays(second.user.id, ['2027-03-01'], 0)).statusCode).toBe(200);
  });

  it('учитывает VACATION_YEAR из конфигурации', async () => {
    const other = await createTestApp(2030);
    try {
      const created = await login(other.app, 'Иван', 'Петров');
      const ok = await other.app.inject({
        method: 'PUT',
        url: `/api/users/${created.user.id}/days`,
        payload: { dates: ['2030-05-05'], version: 0 },
      });
      expect(ok.statusCode).toBe(200);
      const bad = await other.app.inject({
        method: 'PUT',
        url: `/api/users/${created.user.id}/days`,
        payload: { dates: ['2027-05-05'], version: 1 },
      });
      expect(bad.statusCode).toBe(400);
      expect(errorOf(bad).code).toBe('INVALID_DATE');
    } finally {
      await closeTestApp(other);
    }
  });
});
