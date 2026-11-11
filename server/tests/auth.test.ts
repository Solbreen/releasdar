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

it('администратор создаёт пользователей, роли ограничивают действия, смена роли отзывает сессию', async () => {
  const db = openDb(':memory:');
  const app = await buildApp({ db, config: { port: 0, dbPath: ':memory:', vacationYear: 2027, adminLogin: 'Admin', adminPassword: 'Secret123' } });
  const signin = async (login: string, password: string): Promise<string> => { const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login, password } }); expect(r.statusCode).toBe(200); return String(r.headers['set-cookie']).split(';')[0]!; };
  try {
    const admin = await signin('admin', 'Secret123');
    const created = await app.inject({ method: 'POST', url: '/api/accounts', headers: { cookie: admin }, payload: { login: 'Иван', fullName: 'Иван Иванов', password: 'password1', role: 'devops' } });
    expect(created.statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/api/accounts', headers: { cookie: admin }, payload: { login: 'иван', fullName: 'Иван Иванов', password: 'password1', role: 'rp' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: '/api/accounts', headers: { cookie: admin }, payload: { login: 'Мария', fullName: 'Мария Иванова', password: 'password2', role: 'rp' } })).statusCode).toBe(201);
    const stored = db.prepare('SELECT password_hash FROM accounts').get() as { password_hash: string }; expect(stored.password_hash).not.toContain('password1');
    const user = await signin('иВАн', 'password1');
    expect((await app.inject({ method: 'GET', url: '/api/accounts', headers: { cookie: user } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/products', headers: { cookie: user }, payload: {} })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: `/api/accounts/${created.json().id}`, headers: { cookie: admin }, payload: { fullName: 'Иван Петров', role: 'rp', password: 'newpassword' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/accounts', headers: { cookie: admin } })).json().map((a: { fullName: string }) => a.fullName)).toEqual(['Иван Петров', 'Мария Иванова']);
    expect((await app.inject({ method: 'GET', url: '/api/products', headers: { cookie: user } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'Иван', password: 'password1' } })).statusCode).toBe(401);
    const rp = await signin('ИВАН', 'newpassword');
    const product = await app.inject({ method: 'POST', url: '/api/products', headers: { cookie: rp }, payload: { name: 'Продукт', managerId: created.json().id, description: '', color: '#123456' } });
    expect(product.statusCode).toBe(201);
    const release = await app.inject({ method: 'POST', url: '/api/releases', headers: { cookie: rp }, payload: { productId: product.json().id, date: '2027-01-01', description: '', environment: 'Test', releaseType: '' } });
    expect(release.statusCode).toBe(201);
    const rejected = await app.inject({ method: 'POST', url: '/api/releases', headers: { cookie: rp }, payload: { productId: product.json().id, date: '2027-01-02', description: '', environment: 'Test', releaseType: '' } });
    expect((await app.inject({ method: 'PATCH', url: `/api/releases/${rejected.json().id}/status`, headers: { cookie: rp }, payload: { expectedStatus: 'planned', status: 'rejected' } })).statusCode).toBe(200);
    const releaseUrl = `/api/releases/${release.json().id}/status`;
    expect((await app.inject({ method: 'PATCH', url: releaseUrl, headers: { cookie: rp }, payload: { expectedStatus: 'planned', status: 'in_progress' } })).statusCode).toBe(403);
    const createdDev = await app.inject({ method: 'POST', url: '/api/accounts', headers: { cookie: admin }, payload: { login: 'dev', fullName: 'Девопс', password: 'password1', role: 'devops' } });
    expect(createdDev.statusCode).toBe(201);
    const devCookie = await signin('dev', 'password1');
    expect((await app.inject({ method: 'PUT', url: `/api/releases/${release.json().id}`, headers: { cookie: devCookie }, payload: {} })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: releaseUrl, headers: { cookie: devCookie }, payload: { expectedStatus: 'planned', status: 'rejected' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: releaseUrl, headers: { cookie: devCookie }, payload: { expectedStatus: 'planned', status: 'in_progress' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: releaseUrl, headers: { cookie: devCookie }, payload: { expectedStatus: 'planned', status: 'in_progress' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'PATCH', url: releaseUrl, headers: { cookie: devCookie }, payload: { expectedStatus: 'in_progress', status: 'completed' } })).statusCode).toBe(200);
    const accountId = created.json().id;
    expect((await app.inject({ method: 'DELETE', url: `/api/accounts/${accountId}`, headers: { cookie: rp } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'DELETE', url: `/api/accounts/${accountId}`, headers: { cookie: admin } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/products', headers: { cookie: rp } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'Иван', password: 'newpassword' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'DELETE', url: `/api/accounts/${accountId}`, headers: { cookie: admin } })).statusCode).toBe(404);
  } finally { await app.close(); db.close(); }
});
