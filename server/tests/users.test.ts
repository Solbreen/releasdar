import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PALETTE } from '../../shared/palette.js';
import type { UserDto } from '../../shared/types.js';
import { closeTestApp, createTestApp, errorOf, login, type TestContext } from './helpers.js';

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestApp();
});

afterEach(async () => {
  await closeTestApp(ctx);
});

describe('GET /api/health', () => {
  it('отвечает 200 и { ok: true }', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });
});

describe('POST /api/users', () => {
  it('создаёт нового пользователя с 201 и created: true', async () => {
    const result = await login(ctx.app, 'Иван', 'Петров');
    expect(result.statusCode).toBe(201);
    expect(result.created).toBe(true);
    expect(result.user).toMatchObject({
      id: expect.any(Number),
      firstName: 'Иван',
      lastName: 'Петров',
      displayName: 'Иван Петров',
      version: 0,
      days: [],
    });
    expect(PALETTE).toContain(result.user.color);
  });

  it('нормализует пробелы в обеих частях имени', async () => {
    const result = await login(ctx.app, '   Иван  Петрович  ', '  Петров  ');
    expect(result.user.firstName).toBe('Иван Петрович');
    expect(result.user.lastName).toBe('Петров');
    expect(result.user.displayName).toBe('Иван Петрович Петров');
  });

  it('сохраняет дефис в двойной фамилии', async () => {
    const result = await login(ctx.app, 'Кузьма', 'Петров-Водкин');
    expect(result.user.lastName).toBe('Петров-Водкин');
    expect(result.user.displayName).toBe('Кузьма Петров-Водкин');
  });

  it('возвращает 200 и created: false для существующей пары', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    const second = await login(ctx.app, 'Иван', 'Петров');
    expect(second.statusCode).toBe(200);
    expect(second.created).toBe(false);
    expect(second.user.id).toBe(first.user.id);
  });

  it('узнаёт пользователя при другом регистре', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    const second = await login(ctx.app, 'ИВАН', 'ПЕТРОВ');
    expect(second.created).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    // Имя остаётся тем, как пользователь завёлся изначально.
    expect(second.user.displayName).toBe('Иван Петров');
  });

  it('узнаёт пользователя при написании через е вместо ё', async () => {
    const first = await login(ctx.app, 'Пётр', 'Фёдоров');
    const second = await login(ctx.app, 'Петр', 'Федоров');
    expect(second.created).toBe(false);
    expect(second.user.id).toBe(first.user.id);
  });

  it('узнаёт пользователя при лишних пробелах', async () => {
    const first = await login(ctx.app, 'Анна', 'Смирнова');
    const second = await login(ctx.app, '  анна ', ' смирнова  ');
    expect(second.created).toBe(false);
    expect(second.user.id).toBe(first.user.id);
  });

  it('различает пользователей с одинаковым именем и разными фамилиями', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    const second = await login(ctx.app, 'Иван', 'Сидоров');
    expect(second.created).toBe(true);
    expect(second.user.id).not.toBe(first.user.id);
  });

  it('различает пользователей с одинаковой фамилией и разными именами', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    const second = await login(ctx.app, 'Анна', 'Петрова');
    expect(second.created).toBe(true);
    expect(second.user.id).not.toBe(first.user.id);
  });

  it('не путает перестановку имени и фамилии', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    const second = await login(ctx.app, 'Петров', 'Иван');
    expect(second.created).toBe(true);
    expect(second.user.id).not.toBe(first.user.id);
  });

  it('возвращает уже сохранённые дни при повторном входе', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${created.user.id}/days`,
      payload: { dates: ['2027-05-03', '2027-05-04'], version: 0 },
    });
    const again = await login(ctx.app, 'иван', 'петров');
    expect(again.user.days).toEqual(['2027-05-03', '2027-05-04']);
    expect(again.user.version).toBe(1);
  });

  it('выдаёт разным пользователям разные цвета', async () => {
    const colors: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const result = await login(ctx.app, `Имя${i}`, `Фамилия${i}`);
      colors.push(result.user.color);
    }
    expect(new Set(colors).size).toBe(5);
  });

  it.each([
    ['пустое имя', { firstName: '', lastName: 'Петров' }, 'Укажите имя'],
    ['имя из пробелов', { firstName: '   ', lastName: 'Петров' }, 'Укажите имя'],
    ['пустая фамилия', { firstName: 'Иван', lastName: '' }, 'Укажите фамилию'],
    ['фамилия из пробелов', { firstName: 'Иван', lastName: '  ' }, 'Укажите фамилию'],
    ['отсутствует фамилия', { firstName: 'Иван' }, 'Укажите фамилию'],
    ['отсутствует имя', { lastName: 'Петров' }, 'Укажите имя'],
  ])('возвращает 400 VALIDATION_ERROR: %s', async (_label, payload, message) => {
    const response = await ctx.app.inject({ method: 'POST', url: '/api/users', payload });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response).code).toBe('VALIDATION_ERROR');
    expect(errorOf(response).message).toBe(message);
  });

  it.each([
    ['имя длиннее 30 символов', { firstName: 'я'.repeat(31), lastName: 'Петров' }],
    ['фамилия длиннее 30 символов', { firstName: 'Иван', lastName: 'я'.repeat(31) }],
  ])('возвращает 400 VALIDATION_ERROR: %s', async (_label, payload) => {
    const response = await ctx.app.inject({ method: 'POST', url: '/api/users', payload });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response).code).toBe('VALIDATION_ERROR');
    expect(errorOf(response).message).toMatch(/не длиннее 30/);
  });

  it('принимает имя и фамилию ровно из 30 символов', async () => {
    const result = await login(ctx.app, 'я'.repeat(30), 'ю'.repeat(30));
    expect(result.statusCode).toBe(201);
  });

  it('возвращает 400, если поле не строка', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { firstName: 42, lastName: 'Петров' },
    });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response).code).toBe('VALIDATION_ERROR');
  });

  it('возвращает 400, если тело пустое', async () => {
    const response = await ctx.app.inject({ method: 'POST', url: '/api/users', payload: {} });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response).code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/users/:id', () => {
  it('возвращает пользователя с обеими частями имени', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await ctx.app.inject({ method: 'GET', url: `/api/users/${created.user.id}` });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { user: UserDto }).user).toEqual(created.user);
    expect((response.json() as { user: UserDto }).user.lastName).toBe('Петров');
  });

  it('возвращает 404 USER_NOT_FOUND для неизвестного id', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/users/9999' });
    expect(response.statusCode).toBe(404);
    expect(errorOf(response).code).toBe('USER_NOT_FOUND');
  });

  it('возвращает 400 для нечислового id', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/users/abc' });
    expect(response.statusCode).toBe(400);
    expect(errorOf(response).code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/users/:id', () => {
  async function rename(id: number, payload: Record<string, unknown>) {
    return ctx.app.inject({ method: 'PATCH', url: `/api/users/${id}`, payload });
  }

  it('переименовывает пользователя', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await rename(created.user.id, { firstName: 'Иван', lastName: 'Сидоров' });
    expect(response.statusCode).toBe(200);
    const user = (response.json() as { user: UserDto }).user;
    expect(user.firstName).toBe('Иван');
    expect(user.lastName).toBe('Сидоров');
    expect(user.displayName).toBe('Иван Сидоров');
  });

  it('меняет только имя', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await rename(created.user.id, { firstName: 'Пётр', lastName: 'Петров' });
    expect((response.json() as { user: UserDto }).user.displayName).toBe('Пётр Петров');
  });

  it('после переименования вход по новой паре находит того же пользователя', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await rename(created.user.id, { firstName: 'Иван', lastName: 'Сидоров' });

    const again = await login(ctx.app, 'иван', 'сидоров');
    expect(again.created).toBe(false);
    expect(again.user.id).toBe(created.user.id);

    // Старая пара теперь свободна.
    const old = await login(ctx.app, 'Иван', 'Петров');
    expect(old.created).toBe(true);
  });

  it('возвращает 409 NAME_TAKEN, если пара занята другим', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    await login(ctx.app, 'Анна', 'Смирнова');
    const response = await rename(first.user.id, { firstName: 'анна', lastName: 'смирнова' });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response).code).toBe('NAME_TAKEN');
  });

  it('не считает занятым совпадение только по имени', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    await login(ctx.app, 'Анна', 'Смирнова');
    const response = await rename(first.user.id, { firstName: 'Анна', lastName: 'Петрова' });
    expect(response.statusCode).toBe(200);
  });

  it('не считает занятым совпадение только по фамилии', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    await login(ctx.app, 'Анна', 'Смирнова');
    const response = await rename(first.user.id, { firstName: 'Иван', lastName: 'Смирнова' });
    expect(response.statusCode).toBe(200);
  });

  it('учитывает ё при проверке занятости', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    await login(ctx.app, 'Пётр', 'Фёдоров');
    const response = await rename(first.user.id, { firstName: 'Петр', lastName: 'Федоров' });
    expect(response.statusCode).toBe(409);
    expect(errorOf(response).code).toBe('NAME_TAKEN');
  });

  it('разрешает переименование в ту же пару с другим регистром', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await rename(created.user.id, { firstName: 'ИВАН', lastName: 'ПЕТРОВ' });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { user: UserDto }).user.displayName).toBe('ИВАН ПЕТРОВ');
  });

  it('разрешает переименование в точно ту же пару', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await rename(created.user.id, { firstName: 'Иван', lastName: 'Петров' });
    expect(response.statusCode).toBe(200);
  });

  it('разрешает замену ё на е в собственном имени', async () => {
    const created = await login(ctx.app, 'Пётр', 'Фёдоров');
    const response = await rename(created.user.id, { firstName: 'Петр', lastName: 'Федоров' });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { user: UserDto }).user.displayName).toBe('Петр Федоров');
  });

  it('не меняет version и дни пользователя', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${created.user.id}/days`,
      payload: { dates: ['2027-07-07'], version: 0 },
    });
    const response = await rename(created.user.id, { firstName: 'Иван', lastName: 'Новый' });
    const user = (response.json() as { user: UserDto }).user;
    expect(user.version).toBe(1);
    expect(user.days).toEqual(['2027-07-07']);
  });

  it('возвращает 404 для неизвестного пользователя', async () => {
    const response = await rename(4242, { firstName: 'Кто', lastName: 'Тонибыл' });
    expect(response.statusCode).toBe(404);
    expect(errorOf(response).code).toBe('USER_NOT_FOUND');
  });

  it.each([
    ['пустое имя', { firstName: '  ', lastName: 'Петров' }],
    ['пустая фамилия', { firstName: 'Иван', lastName: '' }],
    ['отсутствует фамилия', { firstName: 'Иван' }],
  ])('возвращает 400 при некорректных данных: %s', async (_label, payload) => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await rename(created.user.id, payload);
    expect(response.statusCode).toBe(400);
    expect(errorOf(response).code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/users/:id', () => {
  it('удаляет пользователя и отвечает 204', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/users/${created.user.id}`,
    });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    const after = await ctx.app.inject({ method: 'GET', url: `/api/users/${created.user.id}` });
    expect(after.statusCode).toBe(404);
  });

  it('каскадно удаляет дни отпуска', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${created.user.id}/days`,
      payload: { dates: ['2027-01-11', '2027-01-12'], version: 0 },
    });
    const before = ctx.db
      .prepare('SELECT COUNT(*) AS count FROM vacation_days WHERE user_id = ?')
      .get(created.user.id) as { count: number };
    expect(before.count).toBe(2);

    await ctx.app.inject({ method: 'DELETE', url: `/api/users/${created.user.id}` });

    const after = ctx.db
      .prepare('SELECT COUNT(*) AS count FROM vacation_days WHERE user_id = ?')
      .get(created.user.id) as { count: number };
    expect(after.count).toBe(0);
  });

  it('не затрагивает дни других пользователей', async () => {
    const first = await login(ctx.app, 'Иван', 'Петров');
    const second = await login(ctx.app, 'Анна', 'Смирнова');
    await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${first.user.id}/days`,
      payload: { dates: ['2027-02-01'], version: 0 },
    });
    await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${second.user.id}/days`,
      payload: { dates: ['2027-02-02'], version: 0 },
    });

    await ctx.app.inject({ method: 'DELETE', url: `/api/users/${first.user.id}` });

    const response = await ctx.app.inject({ method: 'GET', url: `/api/users/${second.user.id}` });
    expect((response.json() as { user: UserDto }).user.days).toEqual(['2027-02-02']);
  });

  it('после удаления пара имя-фамилия снова свободна', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await ctx.app.inject({ method: 'DELETE', url: `/api/users/${created.user.id}` });
    const again = await login(ctx.app, 'Иван', 'Петров');
    expect(again.created).toBe(true);
    expect(again.user.id).not.toBe(created.user.id);
  });

  it('возвращает 404 для неизвестного пользователя', async () => {
    const response = await ctx.app.inject({ method: 'DELETE', url: '/api/users/777' });
    expect(response.statusCode).toBe(404);
    expect(errorOf(response).code).toBe('USER_NOT_FOUND');
  });

  it('возвращает 404 при повторном удалении', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    await ctx.app.inject({ method: 'DELETE', url: `/api/users/${created.user.id}` });
    const second = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/users/${created.user.id}`,
    });
    expect(second.statusCode).toBe(404);
  });
});

describe('неизвестные маршруты', () => {
  it('отдают 404 с JSON-ошибкой для /api/*', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/nope' });
    expect(response.statusCode).toBe(404);
    expect(errorOf(response).code).toBe('NOT_FOUND');
  });
});
