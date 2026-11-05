import type { Db } from './db.js';
import { buildDisplayName, nameKey } from '../shared/name.js';
import { pickColor } from '../shared/palette.js';
import { countVacationDays } from '../shared/holidays.js';
import type { CalendarUserDto, UserDto } from '../shared/types.js';

interface UserRow {
  id: number;
  first_name: string;
  last_name: string;
  color: string;
  version: number;
}

/** Набор полей, который читается из users во всех запросах. */
const USER_COLUMNS = 'id, first_name, last_name, color, version';

/** Ошибка занятого имени — транслируется роутами в 409 NAME_TAKEN. */
export class NameTakenError extends Error {
  constructor() {
    super('NAME_TAKEN');
    this.name = 'NameTakenError';
  }
}

function toDto(row: UserRow, days: string[]): UserDto {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: buildDisplayName(row.first_name, row.last_name),
    color: row.color,
    version: row.version,
    days,
  };
}

function selectDays(db: Db, userId: number): string[] {
  const rows = db
    .prepare('SELECT date FROM vacation_days WHERE user_id = ? ORDER BY date')
    .all(userId) as { date: string }[];
  return rows.map((row) => row.date);
}

function selectRowById(db: Db, id: number): UserRow | undefined {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id) as
    | UserRow
    | undefined;
}

function selectRowByKey(db: Db, key: string): UserRow | undefined {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE name_key = ?`).get(key) as
    | UserRow
    | undefined;
}

export function getUser(db: Db, id: number): UserDto | null {
  const row = selectRowById(db, id);
  if (!row) return null;
  return toDto(row, selectDays(db, id));
}

/**
 * Находит пользователя по нормализованному имени или создаёт нового,
 * назначая наименее используемый цвет палитры.
 */
export function getOrCreateUser(
  db: Db,
  firstName: string,
  lastName: string,
): { user: UserDto; created: boolean } {
  const key = nameKey(firstName, lastName);
  return db.transaction(() => {
    const existing = selectRowByKey(db, key);
    if (existing) {
      return { user: toDto(existing, selectDays(db, existing.id)), created: false };
    }
    const usedColors = (db.prepare('SELECT color FROM users').all() as { color: string }[]).map(
      (row) => row.color,
    );
    const color = pickColor(usedColors);
    const info = db
      .prepare(
        'INSERT INTO users (first_name, last_name, name_key, color, version, created_at) VALUES (?, ?, ?, ?, 0, ?)',
      )
      .run(firstName, lastName, key, color, new Date().toISOString());
    const created = selectRowById(db, Number(info.lastInsertRowid))!;
    return { user: toDto(created, []), created: true };
  })();
}

/** Все пользователи с их днями, отсортированные по фамилии и имени в русской локали. */
export function listCalendarUsers(db: Db): CalendarUserDto[] {
  const rows = db.prepare(`SELECT ${USER_COLUMNS} FROM users`).all() as UserRow[];
  const dayRows = db
    .prepare('SELECT user_id, date FROM vacation_days ORDER BY date')
    .all() as { user_id: number; date: string }[];

  const daysByUser = new Map<number, string[]>();
  for (const row of rows) daysByUser.set(row.id, []);
  for (const day of dayRows) daysByUser.get(day.user_id)?.push(day.date);

  const collator = new Intl.Collator('ru');
  return rows
    .map((row) => {
      const days = daysByUser.get(row.id) ?? [];
      // Праздники в dayCount не входят — считаем общей функцией из /shared.
      return { ...toDto(row, days), dayCount: countVacationDays(days) };
    })
    .sort(
      (a, b) =>
        collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName),
    );
}

export type SaveDaysResult =
  | { status: 'ok'; user: UserDto }
  | { status: 'not_found' }
  | { status: 'conflict'; user: UserDto };

/**
 * Полностью заменяет набор дней пользователя в одной транзакции и увеличивает version.
 * Дубликаты в dates игнорируются (INSERT OR IGNORE по первичному ключу).
 */
export function saveDays(
  db: Db,
  id: number,
  dates: string[],
  version: number,
): SaveDaysResult {
  return db.transaction((): SaveDaysResult => {
    const row = selectRowById(db, id);
    if (!row) return { status: 'not_found' };
    if (row.version !== version) {
      return { status: 'conflict', user: toDto(row, selectDays(db, id)) };
    }
    db.prepare('DELETE FROM vacation_days WHERE user_id = ?').run(id);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO vacation_days (user_id, date) VALUES (?, ?)',
    );
    for (const date of dates) insert.run(id, date);
    db.prepare('UPDATE users SET version = version + 1 WHERE id = ?').run(id);
    const updated = selectRowById(db, id)!;
    return { status: 'ok', user: toDto(updated, selectDays(db, id)) };
  })();
}

/**
 * Переименование. Смена регистра собственного имени разрешена,
 * занятый другим пользователем name_key приводит к NameTakenError.
 */
export function renameUser(
  db: Db,
  id: number,
  firstName: string,
  lastName: string,
): UserDto | null {
  const key = nameKey(firstName, lastName);
  return db.transaction((): UserDto | null => {
    const row = selectRowById(db, id);
    if (!row) return null;
    const owner = selectRowByKey(db, key);
    if (owner && owner.id !== id) throw new NameTakenError();
    db.prepare('UPDATE users SET first_name = ?, last_name = ?, name_key = ? WHERE id = ?').run(
      firstName,
      lastName,
      key,
      id,
    );
    const updated = selectRowById(db, id)!;
    return toDto(updated, selectDays(db, id));
  })();
}

/** Жёсткое удаление; дни уходят каскадом. Возвращает false, если пользователя нет. */
export function deleteUser(db: Db, id: number): boolean {
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return info.changes > 0;
}
