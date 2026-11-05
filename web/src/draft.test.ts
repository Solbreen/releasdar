import { describe, expect, it } from 'vitest';
import { allDatesOfYear } from './calendar-model.js';
import {
  changeCount,
  createDraft,
  dayState,
  effectiveDays,
  hasChanges,
  isSelected,
  rebaseDraft,
  resetDraft,
  setDay,
  toggleDay,
  toggleRange,
} from './draft.js';

const YEAR_DATES = allDatesOfYear(2027);

describe('createDraft', () => {
  it('начинается без изменений', () => {
    const draft = createDraft(['2027-01-01']);
    expect(changeCount(draft)).toBe(0);
    expect(hasChanges(draft)).toBe(false);
    expect(isSelected(draft, '2027-01-01')).toBe(true);
    expect(isSelected(draft, '2027-01-02')).toBe(false);
  });

  it('копирует переданные дни, а не ссылается на них', () => {
    const source = new Set(['2027-01-01']);
    const draft = createDraft(source);
    source.add('2027-01-02');
    expect(isSelected(draft, '2027-01-02')).toBe(false);
  });
});

describe('toggleDay', () => {
  it('добавляет пустой день', () => {
    const draft = toggleDay(createDraft([]), '2027-01-05');
    expect(isSelected(draft, '2027-01-05')).toBe(true);
    expect(dayState(draft, '2027-01-05')).toBe('added');
    expect(changeCount(draft)).toBe(1);
  });

  it('удаляет сохранённый день', () => {
    const draft = toggleDay(createDraft(['2027-01-05']), '2027-01-05');
    expect(isSelected(draft, '2027-01-05')).toBe(false);
    expect(dayState(draft, '2027-01-05')).toBe('removed');
    expect(changeCount(draft)).toBe(1);
  });

  it('повторное переключение добавленного дня убирает изменение', () => {
    let draft = createDraft([]);
    draft = toggleDay(draft, '2027-01-05');
    draft = toggleDay(draft, '2027-01-05');
    expect(changeCount(draft)).toBe(0);
    expect(dayState(draft, '2027-01-05')).toBe('empty');
  });

  it('повторное переключение удалённого дня возвращает его в сохранённые', () => {
    let draft = createDraft(['2027-01-05']);
    draft = toggleDay(draft, '2027-01-05');
    draft = toggleDay(draft, '2027-01-05');
    expect(changeCount(draft)).toBe(0);
    expect(dayState(draft, '2027-01-05')).toBe('saved');
  });

  it('не мутирует исходный черновик', () => {
    const draft = createDraft([]);
    toggleDay(draft, '2027-01-05');
    expect(changeCount(draft)).toBe(0);
    expect(draft.added.size).toBe(0);
  });

  it('считает несколько независимых изменений', () => {
    let draft = createDraft(['2027-01-01']);
    draft = toggleDay(draft, '2027-01-01'); // удалили
    draft = toggleDay(draft, '2027-02-02'); // добавили
    draft = toggleDay(draft, '2027-03-03'); // добавили
    expect(changeCount(draft)).toBe(3);
    expect(effectiveDays(draft)).toEqual(['2027-02-02', '2027-03-03']);
  });
});

describe('setDay', () => {
  it('идемпотентен', () => {
    let draft = createDraft([]);
    draft = setDay(draft, '2027-05-05', true);
    draft = setDay(draft, '2027-05-05', true);
    expect(changeCount(draft)).toBe(1);
    expect(isSelected(draft, '2027-05-05')).toBe(true);
  });

  it('снятие отметки с пустого дня ничего не меняет', () => {
    const draft = setDay(createDraft([]), '2027-05-05', false);
    expect(changeCount(draft)).toBe(0);
  });
});

describe('toggleRange', () => {
  it('добавляет весь диапазон, если первый день был отмечен кликом', () => {
    let draft = createDraft([]);
    draft = toggleDay(draft, '2027-03-01'); // якорь стал отмеченным
    draft = toggleRange(draft, '2027-03-01', '2027-03-05', YEAR_DATES);
    expect(effectiveDays(draft)).toEqual([
      '2027-03-01',
      '2027-03-02',
      '2027-03-03',
      '2027-03-04',
      '2027-03-05',
    ]);
    expect(changeCount(draft)).toBe(5);
  });

  it('снимает весь диапазон, если якорь был снят', () => {
    let draft = createDraft(['2027-03-01', '2027-03-02', '2027-03-03']);
    draft = toggleDay(draft, '2027-03-01'); // якорь стал снятым
    draft = toggleRange(draft, '2027-03-01', '2027-03-03', YEAR_DATES);
    expect(effectiveDays(draft)).toEqual([]);
    expect(changeCount(draft)).toBe(3);
  });

  it('работает в обратном направлении', () => {
    let draft = createDraft([]);
    draft = toggleDay(draft, '2027-03-05');
    draft = toggleRange(draft, '2027-03-05', '2027-03-03', YEAR_DATES);
    expect(effectiveDays(draft)).toEqual(['2027-03-03', '2027-03-04', '2027-03-05']);
  });

  it('включает обе границы диапазона', () => {
    let draft = toggleDay(createDraft([]), '2027-06-10');
    draft = toggleRange(draft, '2027-06-10', '2027-06-12', YEAR_DATES);
    expect(isSelected(draft, '2027-06-10')).toBe(true);
    expect(isSelected(draft, '2027-06-12')).toBe(true);
    expect(isSelected(draft, '2027-06-13')).toBe(false);
    expect(isSelected(draft, '2027-06-09')).toBe(false);
  });

  it('диапазон из одного дня равен состоянию якоря', () => {
    let draft = toggleDay(createDraft([]), '2027-06-10');
    draft = toggleRange(draft, '2027-06-10', '2027-06-10', YEAR_DATES);
    expect(effectiveDays(draft)).toEqual(['2027-06-10']);
    expect(changeCount(draft)).toBe(1);
  });

  it('переходит через границу месяцев', () => {
    let draft = toggleDay(createDraft([]), '2027-01-30');
    draft = toggleRange(draft, '2027-01-30', '2027-02-02', YEAR_DATES);
    expect(effectiveDays(draft)).toEqual([
      '2027-01-30',
      '2027-01-31',
      '2027-02-01',
      '2027-02-02',
    ]);
  });

  it('приводит смешанный диапазон к состоянию якоря', () => {
    // 03-02 уже сохранён, 03-01 и 03-03 пустые
    let draft = createDraft(['2027-03-02']);
    draft = toggleDay(draft, '2027-03-01'); // якорь: добавлен
    draft = toggleRange(draft, '2027-03-01', '2027-03-03', YEAR_DATES);
    expect(effectiveDays(draft)).toEqual(['2027-03-01', '2027-03-02', '2027-03-03']);
    // 03-02 уже был сохранён, поэтому изменений только два
    expect(changeCount(draft)).toBe(2);
  });

  it('снятие смешанного диапазона удаляет только сохранённые дни', () => {
    let draft = createDraft(['2027-03-01', '2027-03-02']);
    draft = toggleDay(draft, '2027-03-01'); // якорь: снят
    draft = toggleRange(draft, '2027-03-01', '2027-03-04', YEAR_DATES);
    expect(effectiveDays(draft)).toEqual([]);
    expect(changeCount(draft)).toBe(2);
    expect(dayState(draft, '2027-03-03')).toBe('empty');
  });

  it('не мутирует исходный черновик', () => {
    const draft = toggleDay(createDraft([]), '2027-03-01');
    const before = changeCount(draft);
    toggleRange(draft, '2027-03-01', '2027-03-10', YEAR_DATES);
    expect(changeCount(draft)).toBe(before);
  });
});

describe('effectiveDays и счётчики', () => {
  it('возвращает отсортированный список', () => {
    let draft = createDraft(['2027-12-31']);
    draft = toggleDay(draft, '2027-01-01');
    draft = toggleDay(draft, '2027-06-15');
    expect(effectiveDays(draft)).toEqual(['2027-01-01', '2027-06-15', '2027-12-31']);
  });

  it('отражает все несохранённые правки', () => {
    let draft = createDraft(['2027-01-01', '2027-01-02']);
    draft = toggleDay(draft, '2027-01-01');
    draft = toggleDay(draft, '2027-05-05');
    expect(effectiveDays(draft)).toEqual(['2027-01-02', '2027-05-05']);
  });
});

describe('resetDraft', () => {
  it('возвращает к сохранённому состоянию', () => {
    let draft = createDraft(['2027-01-01']);
    draft = toggleDay(draft, '2027-01-01');
    draft = toggleDay(draft, '2027-02-02');
    const reset = resetDraft(draft);
    expect(changeCount(reset)).toBe(0);
    expect(effectiveDays(reset)).toEqual(['2027-01-01']);
  });
});

describe('rebaseDraft', () => {
  it('подхватывает новые серверные дни, сохраняя черновик', () => {
    let draft = createDraft(['2027-01-01']);
    draft = toggleDay(draft, '2027-05-05'); // локально добавлен
    const rebased = rebaseDraft(draft, ['2027-01-01', '2027-01-02']);
    expect(rebased.saved.has('2027-01-02')).toBe(true);
    expect(isSelected(rebased, '2027-05-05')).toBe(true);
    expect(changeCount(rebased)).toBe(1);
  });

  it('забывает добавление дня, который уже появился на сервере', () => {
    let draft = createDraft([]);
    draft = toggleDay(draft, '2027-05-05');
    const rebased = rebaseDraft(draft, ['2027-05-05']);
    expect(changeCount(rebased)).toBe(0);
    expect(dayState(rebased, '2027-05-05')).toBe('saved');
  });

  it('забывает удаление дня, которого на сервере больше нет', () => {
    let draft = createDraft(['2027-05-05']);
    draft = toggleDay(draft, '2027-05-05');
    const rebased = rebaseDraft(draft, []);
    expect(changeCount(rebased)).toBe(0);
    expect(dayState(rebased, '2027-05-05')).toBe('empty');
  });

  it('сохраняет удаление дня, который на сервере остался', () => {
    let draft = createDraft(['2027-05-05', '2027-05-06']);
    draft = toggleDay(draft, '2027-05-05');
    const rebased = rebaseDraft(draft, ['2027-05-05', '2027-05-07']);
    expect(dayState(rebased, '2027-05-05')).toBe('removed');
    expect(changeCount(rebased)).toBe(1);
    expect(effectiveDays(rebased)).toEqual(['2027-05-07']);
  });
});
