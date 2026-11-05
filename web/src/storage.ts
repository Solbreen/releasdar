const USER_ID_KEY = 'vacations.userId';
const HIDDEN_IDS_KEY = 'vacations.hiddenUserIds';

/** localStorage может быть недоступен (приватный режим), поэтому все обращения защищены. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* молча игнорируем: сервис работает и без сохранённого состояния */
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* см. выше */
  }
}

export function loadUserId(): number | null {
  const raw = read(USER_ID_KEY);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function saveUserId(id: number): void {
  write(USER_ID_KEY, String(id));
}

export function clearUserId(): void {
  remove(USER_ID_KEY);
}

export function loadHiddenIds(): number[] {
  const raw = read(HIDDEN_IDS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is number => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

export function saveHiddenIds(ids: Iterable<number>): void {
  write(HIDDEN_IDS_KEY, JSON.stringify([...ids]));
}
