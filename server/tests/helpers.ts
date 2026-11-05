import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDb, type Db } from '../db.js';
import type { UserDto } from '../../shared/types.js';

export const YEAR = 2027;

export interface TestContext {
  app: FastifyInstance;
  db: Db;
}

/** Поднимает приложение на базе в памяти. */
export async function createTestApp(year = YEAR): Promise<TestContext> {
  const db = openDb(':memory:');
  const app = await buildApp({
    db,
    config: { port: 0, dbPath: ':memory:', vacationYear: year },
  });
  return { app, db };
}

export async function closeTestApp(ctx: TestContext): Promise<void> {
  await ctx.app.close();
  ctx.db.close();
}

/** Логин или создание пользователя; возвращает тело ответа. */
export async function login(
  app: FastifyInstance,
  firstName: string,
  lastName: string,
): Promise<{ statusCode: number; user: UserDto; created: boolean }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/users',
    payload: { firstName, lastName },
  });
  const body = response.json() as { user: UserDto; created: boolean };
  return { statusCode: response.statusCode, ...body };
}

export function errorOf(response: { json: () => unknown }): {
  code: string;
  message: string;
  user?: UserDto;
} {
  return (response.json() as { error: { code: string; message: string; user?: UserDto } }).error;
}
