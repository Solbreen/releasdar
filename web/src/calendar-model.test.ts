import { describe, expect, it } from 'vitest';
import {
  MONTH_NAMES_RU,
  WEEKDAY_NAMES_RU,
  allDatesOfYear,
  buildMonth,
  buildYear,
  formatHumanDate,
  pluralizeDays,
} from './calendar-model.js';

describe('buildMonth', () => {
  it('у января 2027 пять пустых ячеек до 1 числа (пятница)', () => {
    const month = buildMonth(2027, 1);
    expect(month.weeks[0]!.slice(0, 4).every((cell) => cell === null)).toBe(true);
    expect(month.weeks[0]![4]).toMatchObject({ day: 1, date: '2027-01-01' });
  });

  it('все недели состоят из 7 ячеек', () => {
    for (const month of buildYear(2027)) {
      for (const week of month.weeks) {
        expect(week).toHaveLength(7);
      }
    }
  });

  it('содержит все дни месяца и ни одного лишнего', () => {
    const month = buildMonth(2027, 2);
    const days = month.weeks.flat().filter((cell) => cell !== null);
    expect(days).toHaveLength(28);
    expect(days[0]!.date).toBe('2027-02-01');
    expect(days[27]!.date).toBe('2027-02-28');
  });

  it('помечает выходными только субботы и воскресенья', () => {
    const month = buildMonth(2027, 1);
    for (const week of month.weeks) {
      week.forEach((cell, index) => {
        if (cell) expect(cell.weekend).toBe(index >= 5);
      });
    }
  });

  it('использует русское название месяца', () => {
    expect(buildMonth(2027, 3).title).toBe('Март');
  });
});

describe('buildYear', () => {
  it('возвращает 12 месяцев', () => {
    expect(buildYear(2027)).toHaveLength(12);
    expect(buildYear(2027).map((month) => month.title)).toEqual([...MONTH_NAMES_RU]);
  });
});

describe('WEEKDAY_NAMES_RU', () => {
  it('начинается с понедельника', () => {
    expect(WEEKDAY_NAMES_RU[0]).toBe('пн');
    expect(WEEKDAY_NAMES_RU[6]).toBe('вс');
  });
});

describe('allDatesOfYear', () => {
  it('в 2027 году 365 дней', () => {
    expect(allDatesOfYear(2027)).toHaveLength(365);
  });

  it('отсортирован и начинается с 1 января', () => {
    const dates = allDatesOfYear(2027);
    expect(dates[0]).toBe('2027-01-01');
    expect(dates.at(-1)).toBe('2027-12-31');
    expect([...dates].sort()).toEqual(dates);
  });
});

describe('formatHumanDate', () => {
  it('выводит день и месяц в родительном падеже', () => {
    expect(formatHumanDate('2027-03-05')).toBe('5 марта');
    expect(formatHumanDate('2027-01-01')).toBe('1 января');
    expect(formatHumanDate('2027-12-31')).toBe('31 декабря');
  });
});

describe('pluralizeDays', () => {
  it.each([
    [0, 'дней'],
    [1, 'день'],
    [2, 'дня'],
    [4, 'дня'],
    [5, 'дней'],
    [11, 'дней'],
    [14, 'дней'],
    [21, 'день'],
    [22, 'дня'],
    [25, 'дней'],
    [101, 'день'],
    [111, 'дней'],
  ])('%i → %s', (count, expected) => {
    expect(pluralizeDays(count)).toBe(expected);
  });
});

describe('праздники в модели дня', () => {
  it('помечает праздничные дни названием', () => {
    const january = buildMonth(2027, 1);
    const days = january.weeks.flat().filter((cell) => cell !== null);
    expect(days[0]).toMatchObject({ date: '2027-01-01', holiday: 'Новогодние каникулы' });
    expect(days[6]).toMatchObject({ date: '2027-01-07', holiday: 'Рождество Христово' });
    expect(days[8]).toMatchObject({ date: '2027-01-09', holiday: null });
  });

  it('обычные дни не помечены', () => {
    const march = buildMonth(2027, 3);
    const day15 = march.weeks.flat().find((cell) => cell?.date === '2027-03-15');
    expect(day15?.holiday).toBeNull();
  });

  it('праздник, выпавший на выходной, помечен и как выходной, и как праздник', () => {
    // 1 мая 2027 — суббота.
    const may = buildMonth(2027, 5);
    const first = may.weeks.flat().find((cell) => cell?.date === '2027-05-01');
    expect(first).toMatchObject({ weekend: true, holiday: 'Праздник Весны и Труда' });
  });

  it('в году ровно 14 праздничных дней', () => {
    const holidays = buildYear(2027)
      .flatMap((month) => month.weeks.flat())
      .filter((cell) => cell !== null && cell.holiday !== null);
    expect(holidays).toHaveLength(14);
  });
});
