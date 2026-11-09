import { expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { openDb } from '../db.js';

it('защищает API, проверяет пароль, регистр логина и завершает сессию', async () => {
  const db = openDb(':memory:');
  const app = await buildApp({ db, config: { port: 0, dbPath: ':memory:', vacationYear: 2027, adminLogin: 'Admin', adminPassword: 'Secret123' } });
  try {
    expect((await app.inject({ method: 'GET', url: '/api/products' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'ADMIN', password: 'wrong' } })).statusCode).toBe(401);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'aDmIn', password: 'Secret123' } });
    expect(login.statusCode).toBe(200);
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;
    expect((await app.inject({ method: 'GET', url: '/api/products', headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/products', headers: { cookie } })).statusCode).toBe(401);
  } finally { await app.close(); db.close(); }
});
