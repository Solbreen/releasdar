import { daysInMonth, formatIsoDate, isWeekend, weekdayMondayFirst } from '../../shared/dates.js';

export const MONTH_NAMES_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

export const MONTH_NAMES_GENITIVE_RU = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

/** Неделя начинается с понедельника. */
export const WEEKDAY_NAMES_RU = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

export interface DayModel {
  date: string;
  day: number;
  weekend: boolean;
  /** Название нерабочего праздника или null. Праздник важнее выходного. */
  holiday: string | null;
}

export interface MonthModel {
  month: number;
  title: string;
  /** Недели месяца; null — пустая ячейка до первого или после последнего числа. */
  weeks: (DayModel | null)[][];
}

/** Строит сетку одного месяца: недели по 7 ячеек, первая колонка — понедельник. */
export function buildMonth(year: number, month: number): MonthModel {
  const total = daysInMonth(year, month);
  const leading = weekdayMondayFirst(year, month, 1);
  const cells: (DayModel | null)[] = Array.from({ length: leading }, () => null);

  for (let day = 1; day <= total; day += 1) {
    const date = formatIsoDate(year, month, day);
    cells.push({
      date,
      day,
      weekend: isWeekend(year, month, day),
      holiday: null,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (DayModel | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return { month, title: MONTH_NAMES_RU[month - 1]!, weeks };
}

export function buildYear(year: number): MonthModel[] {
  return Array.from({ length: 12 }, (_, index) => buildMonth(year, index + 1));
}

/** Все даты года в возрастающем порядке — основа для выделения диапазонов. */
export function allDatesOfYear(year: number): string[] {
  const dates: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= daysInMonth(year, month); day += 1) {
      dates.push(formatIsoDate(year, month, day));
    }
  }
  return dates;
}

/** Человекочитаемая дата для подсказок: «5 марта». */
export function formatHumanDate(date: string): string {
  const [, month, day] = date.split('-');
  const monthName = MONTH_NAMES_GENITIVE_RU[Number(month) - 1];
  if (!monthName || !day) return date;
  return `${Number(day)} ${monthName}`;
}

/** Склонение слова «день» для счётчиков: 1 день, 2 дня, 5 дней. */
export function pluralizeDays(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}
