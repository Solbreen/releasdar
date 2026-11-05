import { describe, expect, it } from 'vitest';
import {
  daysInMonth,
  formatIsoDate,
  isDateInYear,
  isValidIsoDate,
  isWeekend,
  parseIsoDate,
  weekdayMondayFirst,
} from './dates.js';

describe('parseIsoDate', () => {
  it('разбирает корректную дату', () => {
    expect(parseIsoDate('2027-03-09')).toEqual({ year: 2027, month: 3, day: 9 });
  });

  it.each([
    'не дата',
    '',
    '2027-3-9',
    '2027/03/09',
    '20270309',
    '2027-03-09T00:00:00Z',
    ' 2027-03-09',
    '2027-03-09 ',
  ])('отвергает формат %j', (value) => {
    expect(parseIsoDate(value)).toBeNull();
  });

  it.each([
    ['2027-00-10', 'нулевой месяц'],
    ['2027-13-01', 'тринадцатый месяц'],
    ['2027-01-00', 'нулевой день'],
    ['2027-01-32', '32 января'],
    ['2027-02-29', '29 февраля в невисокосном году'],
    ['2027-02-30', '30 февраля'],
    ['2027-04-31', '31 апреля'],
    ['2027-06-31', '31 июня'],
    ['2027-09-31', '31 сентября'],
    ['2027-11-31', '31 ноября'],
  ])('отвергает несуществующую дату %s (%s)', (value) => {
    expect(parseIsoDate(value)).toBeNull();
  });

  it.each(['2027-01-31', '2027-02-28', '2027-04-30', '2027-12-31'])(
    'принимает граничную дату %s',
    (value) => {
      expect(parseIsoDate(value)).not.toBeNull();
    },
  );

  it('проверка существования даты честная для високосных годов', () => {
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2027-02-29')).toBe(false);
    expect(isValidIsoDate('2100-02-29')).toBe(false);
    expect(isValidIsoDate('2000-02-29')).toBe(true);
  });
});

describe('daysInMonth', () => {
  it('знает длину месяцев 2027 года', () => {
    const lengths = Array.from({ length: 12 }, (_, i) => daysInMonth(2027, i + 1));
    expect(lengths).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });
});

describe('isDateInYear', () => {
  it('принимает дату внутри года', () => {
    expect(isDateInYear('2027-01-01', 2027)).toBe(true);
    expect(isDateInYear('2027-12-31', 2027)).toBe(true);
  });

  it('отвергает дату другого года', () => {
    expect(isDateInYear('2026-12-31', 2027)).toBe(false);
    expect(isDateInYear('2028-01-01', 2027)).toBe(false);
  });

  it('отвергает несуществующую дату нужного года', () => {
    expect(isDateInYear('2027-02-29', 2027)).toBe(false);
  });
});

describe('formatIsoDate', () => {
  it('добавляет ведущие нули', () => {
    expect(formatIsoDate(2027, 1, 5)).toBe('2027-01-05');
    expect(formatIsoDate(2027, 12, 31)).toBe('2027-12-31');
  });
});

describe('weekdayMondayFirst', () => {
  it('1 января 2027 — пятница', () => {
    expect(weekdayMondayFirst(2027, 1, 1)).toBe(4);
  });

  it('31 декабря 2027 — пятница', () => {
    expect(weekdayMondayFirst(2027, 12, 31)).toBe(4);
  });

  it('совпадает с Date для всех дней 2027 года', () => {
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= daysInMonth(2027, month); day += 1) {
        const expected = (new Date(Date.UTC(2027, month - 1, day)).getUTCDay() + 6) % 7;
        expect(weekdayMondayFirst(2027, month, day)).toBe(expected);
      }
    }
  });
});

describe('isWeekend', () => {
  it('2 и 3 января 2027 — суббота и воскресенье', () => {
    expect(isWeekend(2027, 1, 2)).toBe(true);
    expect(isWeekend(2027, 1, 3)).toBe(true);
  });

  it('4 января 2027 — понедельник, не выходной', () => {
    expect(isWeekend(2027, 1, 4)).toBe(false);
  });
});
