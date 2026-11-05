const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface ParsedDate {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

/**
 * Разбирает строку 'YYYY-MM-DD' и проверяет, что такая дата действительно существует.
 * Возвращает null для любого мусора, включая 2027-02-30 и 2027-13-01.
 */
export function parseIsoDate(value: string): ParsedDate | null {
  const m = ISO_DATE_RE.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isValidIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

/** Существующая дата, попадающая в указанный год. */
export function isDateInYear(value: string, year: number): boolean {
  const parsed = parseIsoDate(value);
  return parsed !== null && parsed.year === year;
}

export function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * День недели по дате: 0 = понедельник ... 6 = воскресенье.
 * Считается по алгоритму Сакамото, без зависимости от таймзоны рантайма.
 */
export function weekdayMondayFirst(year: number, month: number, day: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let y = year;
  if (month < 3) y -= 1;
  const sundayFirst =
    (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[month - 1]! + day) % 7;
  return (sundayFirst + 6) % 7;
}

export function isWeekend(year: number, month: number, day: number): boolean {
  return weekdayMondayFirst(year, month, day) >= 5;
}
