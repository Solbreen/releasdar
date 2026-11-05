import Database from 'better-sqlite3';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Db = Database.Database;

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Открывает базу, включает нужные PRAGMA и применяет миграции.
 * dbPath = ':memory:' используется в тестах.
 */
export function openDb(dbPath: string): Db {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  // WAL бессмысленен и недоступен для in-memory базы.
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  migrate(db);
  return db;
}

interface Migration {
  version: number;
  name: string;
  sql: string;
}

function loadMigrations(): Migration[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  return files.map((file) => {
    const match = /^(\d+)_/.exec(file);
    if (!match) {
      throw new Error(`Файл миграции должен начинаться с номера: ${file}`);
    }
    return {
      version: Number(match[1]),
      name: file,
      sql: readFileSync(join(MIGRATIONS_DIR, file), 'utf8'),
    };
  });
}

/** Применяет все миграции, номер которых больше текущей версии схемы. */
export function migrate(db: Db): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);

  const row = db.prepare('SELECT MAX(version) AS version FROM schema_version').get() as {
    version: number | null;
  };
  const current = row.version ?? 0;

  const record = db.prepare(
    'INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)',
  );

  for (const migration of loadMigrations()) {
    if (migration.version <= current) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      record.run(migration.version, migration.name, new Date().toISOString());
    })();
  }
}
