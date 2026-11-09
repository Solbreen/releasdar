import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { migrate, openDb } from '../db.js';
import { closeTestApp, createTestApp, errorOf, type TestContext } from './helpers.js';

describe('миграции', () => {
  it('создают таблицы и записывают версию схемы', () => {
    const db = openDb(':memory:');
    try {
      const tables = (
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
          name: string;
        }[]
      ).map((row) => row.name);
      expect(tables).toContain('users');
      expect(tables).toContain('vacation_days');
      expect(tables).toContain('schema_version');
      expect(tables).toContain('products');
      expect(tables).toContain('releases');

      const version = db.prepare('SELECT MAX(version) AS version FROM schema_version').get() as {
        version: number;
      };
      expect(version.version).toBeGreaterThanOrEqual(1);
    } finally {
      db.close();
    }
  });

  it('идемпотентны при повторном применении', () => {
    const db = openDb(':memory:');
    try {
      const before = db.prepare('SELECT COUNT(*) AS count FROM schema_version').get() as {
        count: number;
      };
      expect(() => migrate(db)).not.toThrow();
      expect(() => migrate(db)).not.toThrow();
      const after = db.prepare('SELECT COUNT(*) AS count FROM schema_version').get() as {
        count: number;
      };
      expect(after.count).toBe(before.count);
    } finally {
      db.close();
    }
  });

  it('включают foreign_keys', () => {
    const db = openDb(':memory:');
    try {
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
      // ссылка на несуществующего пользователя должна отвергаться
      expect(() =>
        db.prepare('INSERT INTO vacation_days (user_id, date) VALUES (?, ?)').run(999, '2027-01-01'),
      ).toThrow(/FOREIGN KEY/i);
    } finally {
      db.close();
    }
  });

  describe('файловая база', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'vacations-test-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('включает WAL и переживает переоткрытие', () => {
      const path = join(dir, 'nested', 'vacations.db');
      const first = openDb(path);
      expect(first.pragma('journal_mode', { simple: true })).toBe('wal');
      first
        .prepare(
          'INSERT INTO users (first_name, last_name, name_key, color, version, created_at) VALUES (?, ?, ?, ?, 0, ?)',
        )
        .run('Иван', 'Петров', 'иван петров', '#e4572e', '2026-01-01T00:00:00.000Z');
      first.close();

      const second = openDb(path);
      const row = second.prepare('SELECT first_name, last_name FROM users').get() as {
        first_name: string;
        last_name: string;
      };
      expect(row.first_name).toBe('Иван');
      expect(row.last_name).toBe('Петров');
      second.close();
    });

    it('удаляет старых пользователей при миграции и сохраняет новые продукты', () => {
      const path = join(dir, 'old.db');
      const old = new Database(path);
      old.exec(readFileSync(new URL('../migrations/001_init.sql', import.meta.url), 'utf8'));
      old.exec("CREATE TABLE schema_version (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL); INSERT INTO schema_version VALUES (1, '001_init.sql', '2026-01-01'); INSERT INTO users (first_name, last_name, name_key, color, created_at) VALUES ('Иван', 'Иванов', 'иван иванов', '#123456', '2026-01-01'); INSERT INTO vacation_days VALUES (1, '2027-01-01');");
      old.close();
      const migrated = openDb(path);
      expect(migrated.prepare('SELECT * FROM users').all()).toHaveLength(0);
      expect(migrated.prepare('SELECT * FROM vacation_days').all()).toHaveLength(0);
      migrated.prepare('INSERT INTO products (name, manager, color) VALUES (?, ?, ?)').run('Продукт', 'Руководитель', '#123456');
      migrated.close();
      const reopened = openDb(path);
      expect(reopened.prepare('SELECT name FROM products').get()).toEqual({ name: 'Продукт' });
      reopened.close();
    });
  });
});

describe('лимит тела запроса', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await closeTestApp(ctx);
  });

  it('отвергает тело больше 64 КБ', async () => {
    const response = await ctx.app.inject({ headers: { cookie: ctx.cookie },
      method: 'POST',
      url: '/api/products',
      payload: { name: 'Продукт', manager: 'Руководитель', color: '#123456', description: 'x'.repeat(70000) },
    });
    expect(response.statusCode).toBe(413);
    expect(errorOf(response).message).toMatch(/[а-яА-Я]/);
  });

  it('принимает допустимое описание продукта', async () => {
    ctx.db.prepare("INSERT INTO accounts (login, login_key, password_hash, role, created_at, full_name) VALUES ('rp', 'rp', 'x', 'rp', '2026', 'Руководитель')").run();
    const response = await ctx.app.inject({ headers: { cookie: ctx.cookie },
      method: 'POST',
      url: '/api/products',
      payload: { name: 'Продукт', managerId: 1, color: '#123456', description: 'x'.repeat(10000) },
    });
    expect(response.statusCode).toBe(201);
  });
});
