import { describe, expect, it } from 'vitest';
import {
  HOLIDAYS,
  countVacationDays,
  countVacationDaysByMonth,
  findHolidayName,
  isHoliday,
} from './holidays.js';
import { daysInMonth, formatIsoDate } from './dates.js';

const YEAR = 2027;

/** Все даты года — чтобы не тянуть в тест /shared зависимость от клиента. */
function allDatesOfYear(year: number): string[] {
  const dates: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= daysInMonth(year, month); day += 1) {
      dates.push(formatIsoDate(year, month, day));
    }
  }
  return dates;
}

/** Все праздничные даты VACATION_YEAR в формате YYYY-MM-DD. */
const HOLIDAY_DATES = HOLIDAYS.map(
  (holiday) =>
    `${YEAR}-${String(holiday.month).padStart(2, '0')}-${String(holiday.day).padStart(2, '0')}`,
);

describe('список праздников', () => {
  it('содержит ровно 14 нерабочих дней', () => {
    expect(HOLIDAYS).toHaveLength(14);
  });

  it('все даты уникальны', () => {
    expect(new Set(HOLIDAY_DATES).size).toBe(HOLIDAYS.length);
  });

  it('включает новогодние каникулы 1–6 и 8 января', () => {
    for (const day of [1, 2, 3, 4, 5, 6, 8]) {
      expect(findHolidayName(`2027-01-${String(day).padStart(2, '0')}`)).toBe(
        'Новогодние каникулы',
      );
    }
  });

  it('7 января — Рождество Христово, а не каникулы', () => {
    expect(findHolidayName('2027-01-07')).toBe('Рождество Христово');
  });

  it.each([
    ['2027-02-23', 'День защитника Отечества'],
    ['2027-03-08', 'Международный женский день'],
    ['2027-05-01', 'Праздник Весны и Труда'],
    ['2027-05-09', 'День Победы'],
    ['2027-06-12', 'День России'],
    ['2027-11-04', 'День народного единства'],
  ])('%s — %s', (date, name) => {
    expect(findHolidayName(date)).toBe(name);
  });

  it('9 января уже рабочий день', () => {
    expect(isHoliday('2027-01-09')).toBe(false);
  });

  it('не помечает обычные дни', () => {
    expect(findHolidayName('2027-03-09')).toBeNull();
    expect(isHoliday('2027-07-15')).toBe(false);
  });

  it('не зависит от года', () => {
    expect(findHolidayName('2030-05-09')).toBe('День Победы');
  });

  it('возвращает null для мусора', () => {
    expect(findHolidayName('не дата')).toBeNull();
    expect(findHolidayName('2027-02-30')).toBeNull();
  });
});

describe('countVacationDays', () => {
  it('пустой набор даёт ноль', () => {
    expect(countVacationDays([])).toBe(0);
  });

  it('считает обычные дни', () => {
    expect(countVacationDays(['2027-03-15', '2027-03-16', '2027-03-17'])).toBe(3);
  });

  it('считает выходные наравне с буднями', () => {
    // 2027-03-13 суббота, 2027-03-14 воскресенье
    expect(countVacationDays(['2027-03-13', '2027-03-14'])).toBe(2);
  });

  it('не считает праздники', () => {
    expect(countVacationDays(['2027-05-09'])).toBe(0);
    expect(countVacationDays(['2027-05-08', '2027-05-09', '2027-05-10'])).toBe(2);
  });

  it('не считает ни один день новогодних каникул 1–8 января', () => {
    const january = Array.from(
      { length: 8 },
      (_, index) => `2027-01-0${index + 1}`,
    );
    expect(countVacationDays(january)).toBe(0);
  });

  it('праздник, выпавший на выходной, тоже не считается', () => {
    // 2027-05-01 — суббота, 2027-05-09 — воскресенье
    expect(countVacationDays(['2027-05-01', '2027-05-09'])).toBe(0);
  });

  it('набор только из праздников даёт ноль', () => {
    expect(countVacationDays(HOLIDAY_DATES)).toBe(0);
  });

  it('игнорирует дубликаты', () => {
    expect(countVacationDays(['2027-03-15', '2027-03-15', '2027-03-15'])).toBe(1);
  });

  it('игнорирует несуществующие даты', () => {
    expect(countVacationDays(['2027-03-15', '2027-02-30', 'вчера'])).toBe(1);
  });

  it('весь год минус праздники', () => {
    expect(countVacationDays(allDatesOfYear(YEAR))).toBe(365 - HOLIDAYS.length);
  });
});

describe('countVacationDaysByMonth', () => {
  it('пустой набор даёт пустую разбивку', () => {
    expect(countVacationDaysByMonth([])).toEqual([]);
  });

  it('группирует дни по месяцам в хронологическом порядке', () => {
    const dates = ['2027-04-02', '2027-03-15', '2027-04-01', '2027-03-16', '2027-03-17'];
    expect(countVacationDaysByMonth(dates)).toEqual([
      { month: 3, count: 3 },
      { month: 4, count: 2 },
    ]);
  });

  it('не показывает месяц, где выбраны только праздники', () => {
    const dates = ['2027-01-05', '2027-01-07', '2027-03-15'];
    expect(countVacationDaysByMonth(dates)).toEqual([{ month: 3, count: 1 }]);
  });

  it('месяц с нулём засчитанных дней полностью исчезает', () => {
    expect(countVacationDaysByMonth(['2027-05-01', '2027-05-09'])).toEqual([]);
  });

  it('исключает праздники внутри месяца', () => {
    const dates = ['2027-05-01', '2027-05-02', '2027-05-09', '2027-05-10'];
    expect(countVacationDaysByMonth(dates)).toEqual([{ month: 5, count: 2 }]);
  });

  it('игнорирует дубликаты', () => {
    expect(countVacationDaysByMonth(['2027-03-15', '2027-03-15'])).toEqual([
      { month: 3, count: 1 },
    ]);
  });

  it.each([
    ['обычные дни', ['2027-03-15', '2027-04-20', '2027-12-31']],
    ['дни с праздниками', ['2027-01-05', '2027-01-09', '2027-05-09', '2027-05-10']],
    ['только праздники', HOLIDAY_DATES],
    ['весь год', allDatesOfYear(YEAR)],
    ['с дубликатами и мусором', ['2027-03-15', '2027-03-15', '2027-02-30', 'нет']],
  ])('сумма по месяцам равна общему счётчику: %s', (_label, dates) => {
    const total = countVacationDaysByMonth(dates).reduce((sum, item) => sum + item.count, 0);
    expect(total).toBe(countVacationDays(dates));
  });

  it('каждый месяц встречается не более одного раза', () => {
    const result = countVacationDaysByMonth(allDatesOfYear(YEAR));
    expect(new Set(result.map((item) => item.month)).size).toBe(result.length);
    expect(result).toHaveLength(12);
  });
});
