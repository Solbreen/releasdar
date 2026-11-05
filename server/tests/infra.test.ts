import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate, openDb } from '../db.js';
import { closeTestApp, createTestApp, errorOf, login, type TestContext } from './helpers.js';

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
    const created = await login(ctx.app, 'Иван', 'Петров');
    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${created.user.id}/days`,
      payload: { dates: Array.from({ length: 6000 }, () => '2027-01-01'), version: 0 },
    });
    expect(response.statusCode).toBe(413);
    expect(errorOf(response).message).toMatch(/[а-яА-Я]/);
  });

  it('принимает полный год дат (366 строк заметно меньше лимита)', async () => {
    const created = await login(ctx.app, 'Иван', 'Петров');
    const dates: string[] = [];
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= 28; day += 1) {
        dates.push(`2027-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
    }
    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/api/users/${created.user.id}/days`,
      payload: { dates, version: 0 },
    });
    expect(response.statusCode).toBe(200);
  });
});
