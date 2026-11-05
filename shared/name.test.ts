import { describe, expect, it } from 'vitest';
import {
  NAME_PART_MAX_LENGTH,
  buildDisplayName,
  nameKey,
  normalizeNamePart,
} from './name.js';
import { firstNameSchema, lastNameSchema, personNameSchema } from './schemas.js';

describe('normalizeNamePart', () => {
  it('обрезает пробелы по краям', () => {
    expect(normalizeNamePart('  Иван  ')).toBe('Иван');
  });

  it('схлопывает повторяющиеся пробелы внутри поля', () => {
    expect(normalizeNamePart('Иван    Петрович')).toBe('Иван Петрович');
  });

  it('схлопывает табуляции и переводы строк', () => {
    expect(normalizeNamePart('Иван\t\nПетрович')).toBe('Иван Петрович');
  });

  it('сохраняет регистр, введённый пользователем', () => {
    expect(normalizeNamePart('ИвАн')).toBe('ИвАн');
  });

  it('сохраняет дефис двойной фамилии', () => {
    expect(normalizeNamePart('  Петров-Водкин ')).toBe('Петров-Водкин');
  });

  it('строка из пробелов превращается в пустую', () => {
    expect(normalizeNamePart('   \t ')).toBe('');
  });
});

describe('buildDisplayName', () => {
  it('склеивает имя и фамилию через пробел', () => {
    expect(buildDisplayName('Иван', 'Петров')).toBe('Иван Петров');
  });

  it('нормализует обе части', () => {
    expect(buildDisplayName('  Иван ', '  Петров  ')).toBe('Иван Петров');
  });

  it('сохраняет регистр', () => {
    expect(buildDisplayName('ИВАН', 'петров')).toBe('ИВАН петров');
  });
});

describe('nameKey', () => {
  it('приводит к нижнему регистру', () => {
    expect(nameKey('Иван', 'Петров')).toBe('иван петров');
  });

  it('заменяет ё на е', () => {
    expect(nameKey('Пётр', 'Фёдоров')).toBe('петр федоров');
  });

  it('заменяет Ё на е', () => {
    expect(nameKey('ПЁТР', 'ФЁДОРОВ')).toBe('петр федоров');
  });

  it('считает одним ключом разные написания одной пары', () => {
    const variants: [string, string][] = [
      ['Пётр', 'Алексеев'],
      ['  пётр ', ' алексеев  '],
      ['ПЕТР', 'АЛЕКСЕЕВ'],
      ['Петр', 'Алексеев'],
    ];
    const keys = new Set(variants.map(([first, last]) => nameKey(first, last)));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toBe('петр алексеев');
  });

  it('учитывает обе части: разные фамилии дают разные ключи', () => {
    expect(nameKey('Иван', 'Петров')).not.toBe(nameKey('Иван', 'Сидоров'));
    expect(nameKey('Иван', 'Петров')).not.toBe(nameKey('Пётр', 'Иванов'));
  });

  it('не путает перестановку имени и фамилии', () => {
    expect(nameKey('Иван', 'Петров')).not.toBe(nameKey('Петров', 'Иван'));
  });

  it('учитывает дефис в фамилии', () => {
    expect(nameKey('Кузьма', 'Петров-Водкин')).toBe('кузьма петров-водкин');
    expect(nameKey('Кузьма', 'Петров-Водкин')).not.toBe(nameKey('Кузьма', 'Петров Водкин'));
  });

  it('работает с латиницей', () => {
    expect(nameKey('  John ', ' DOE ')).toBe('john doe');
  });
});

describe('схемы имени и фамилии', () => {
  it('нормализуют значение при разборе', () => {
    const result = personNameSchema.parse({ firstName: '  Иван  ', lastName: ' Петров ' });
    expect(result).toEqual({ firstName: 'Иван', lastName: 'Петров' });
  });

  it('схлопывают пробелы внутри поля', () => {
    expect(firstNameSchema.parse('Иван   Петрович')).toBe('Иван Петрович');
  });

  it('принимают дефис', () => {
    expect(lastNameSchema.parse('Петров-Водкин')).toBe('Петров-Водкин');
  });

  it.each([
    ['пустое имя', ''],
    ['имя из пробелов', '   '],
  ])('отвергают %s', (_label, value) => {
    const result = firstNameSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Укажите имя');
  });

  it.each([
    ['пустую фамилию', ''],
    ['фамилию из пробелов', '  '],
  ])('отвергают %s', (_label, value) => {
    const result = lastNameSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Укажите фамилию');
  });

  it(`принимают ровно ${NAME_PART_MAX_LENGTH} символов`, () => {
    expect(firstNameSchema.safeParse('я'.repeat(NAME_PART_MAX_LENGTH)).success).toBe(true);
  });

  it(`отвергают больше ${NAME_PART_MAX_LENGTH} символов`, () => {
    const result = lastNameSchema.safeParse('я'.repeat(NAME_PART_MAX_LENGTH + 1));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/не длиннее 30/);
  });

  it('отвергают отсутствующую фамилию', () => {
    const result = personNameSchema.safeParse({ firstName: 'Иван' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Укажите фамилию');
  });

  it('отвергают нестроковые значения', () => {
    expect(personNameSchema.safeParse({ firstName: 42, lastName: 'Петров' }).success).toBe(false);
  });
});
