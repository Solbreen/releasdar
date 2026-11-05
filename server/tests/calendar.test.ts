import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CalendarDto } from '../../shared/types.js';
import { closeTestApp, createTestApp, login, type TestContext } from './helpers.js';

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestApp();
});

afterEach(async () => {
  await closeTestApp(ctx);
});

async function calendar(): Promise<CalendarDto> {
  const response = await ctx.app.inject({ method: 'GET', url: '/api/calendar' });
  expect(response.statusCode).toBe(200);
  return response.json() as CalendarDto;
}

async function setDays(id: number, dates: string[], version = 0): Promise<void> {
  const response = await ctx.app.inject({
    method: 'PUT',
    url: `/api/users/${id}/days`,
    payload: { dates, version },
  });
  expect(response.statusCode).toBe(200);
}

describe('GET /api/calendar', () => {
  it('возвращает год и пустой список, пока нет пользователей', async () => {
    expect(await calendar()).toEqual({ year: 2027, users: [] });
  });

  it('возвращает пользователей с днями и dayCount', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await setDays(created.user.id, ['2027-03-15', '2027-03-16', '2027-03-17']);

    const data = await calendar();
    expect(data.users).toHaveLength(1);
    expect(data.users[0]).toMatchObject({
      id: created.user.id,
      firstName: 'Иван',
      lastName: 'Петров',
      displayName: 'Иван Петров',
      color: created.user.color,
      version: 1,
      days: ['2027-03-15', '2027-03-16', '2027-03-17'],
      dayCount: 3,
    });
  });

  it('dayCount равен нулю для пользователя без дней', async () => {
    await login(ctx.app, 'Иван', 'Петров');
    const data = await calendar();
    expect(data.users[0]!.dayCount).toBe(0);
    expect(data.users[0]!.days).toEqual([]);
  });

  it('сортирует пользователей по фамилии в русской локали', async () => {
    for (const [first, last] of [
      ['Иван', 'Яковлев'],
      ['Иван', 'Борисов'],
      ['Иван', 'Антонов'],
    ] as const) {
      await login(ctx.app, first, last);
    }
    const data = await calendar();
    expect(data.users.map((user) => user.lastName)).toEqual(['Антонов', 'Борисов', 'Яковлев']);
  });

  it('при одинаковой фамилии сортирует по имени', async () => {
    for (const [first, last] of [
      ['Ярослав', 'Петров'],
      ['Анна', 'Петров'],
      ['Мария', 'Петров'],
    ] as const) {
      await login(ctx.app, first, last);
    }
    const data = await calendar();
    expect(data.users.map((user) => user.firstName)).toEqual(['Анна', 'Мария', 'Ярослав']);
  });

  it('сортировка идёт по фамилии, а не по отображаемому имени', async () => {
    await login(ctx.app, 'Анна', 'Яковлева');
    await login(ctx.app, 'Ярослав', 'Антонов');
    const data = await calendar();
    // По displayName первым был бы «Анна Яковлева», по фамилии — «Ярослав Антонов».
    expect(data.users.map((user) => user.displayName)).toEqual([
      'Ярослав Антонов',
      'Анна Яковлева',
    ]);
  });

  it('не показывает удалённого пользователя', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    await login(ctx.app, 'Анна', 'Смирнова');
    await ctx.app.inject({ method: 'DELETE', url: `/api/users/${first.user.id}` });

    const data = await calendar();
    expect(data.users.map((user) => user.displayName)).toEqual(['Анна Смирнова']);
  });

  it('у каждого пользователя свои дни', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    const second = await login(ctx.app, 'Анна', 'Смирнова');
    await setDays(first.user.id, ['2027-03-01', '2027-03-02']);
    await setDays(second.user.id, ['2027-03-02']);

    const data = await calendar();
    const byName = new Map(data.users.map((user) => [user.displayName, user]));
    expect(byName.get('Иван Петров')!.days).toEqual(['2027-03-01', '2027-03-02']);
    expect(byName.get('Иван Петров')!.dayCount).toBe(2);
    expect(byName.get('Анна Смирнова')!.days).toEqual(['2027-03-02']);
    expect(byName.get('Анна Смирнова')!.dayCount).toBe(1);
  });

  it('отдаёт настроенный год', async () => {
    const other = await createTestApp(2030);
    try {
      const response = await other.app.inject({ method: 'GET', url: '/api/calendar' });
      expect((response.json() as CalendarDto).year).toBe(2030);
    } finally {
      await closeTestApp(other);
    }
  });
});

describe('dayCount и праздники', () => {
  it('не учитывает праздничный день', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    // 9 мая — праздник, 10 мая — обычный день.
    await setDays(created.user.id, ['2027-05-09', '2027-05-10']);

    const data = await calendar();
    expect(data.users[0]!.days).toEqual(['2027-05-09', '2027-05-10']);
    expect(data.users[0]!.dayCount).toBe(1);
  });

  it('праздничные дни сохраняются, но дают dayCount = 0', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await setDays(created.user.id, ['2027-01-01', '2027-01-07', '2027-06-12']);

    const data = await calendar();
    expect(data.users[0]!.days).toHaveLength(3);
    expect(data.users[0]!.dayCount).toBe(0);
  });

  it('не учитывает ни один день новогодних каникул 1–8 января', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const january = Array.from({ length: 8 }, (_, index) => `2027-01-0${index + 1}`);
    await setDays(created.user.id, [...january, '2027-01-09']);

    const data = await calendar();
    expect(data.users[0]!.dayCount).toBe(1);
  });

  it('учитывает выходные, но не праздник, выпавший на выходной', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    // 2027-05-01 — суббота и праздник, 2027-05-02 — воскресенье и обычный день.
    await setDays(created.user.id, ['2027-05-01', '2027-05-02']);

    const data = await calendar();
    expect(data.users[0]!.dayCount).toBe(1);
  });

  it('dayCount обновляется после пересохранения дней', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await setDays(created.user.id, ['2027-05-09']);
    expect((await calendar()).users[0]!.dayCount).toBe(0);

    await setDays(created.user.id, ['2027-05-09', '2027-05-11', '2027-05-12'], 1);
    expect((await calendar()).users[0]!.dayCount).toBe(2);
  });
});
