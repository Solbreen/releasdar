import { describe, expect, it } from 'vitest';
import { PALETTE, pickColor } from './palette.js';

describe('PALETTE', () => {
  it('содержит 16 цветов', () => {
    expect(PALETTE).toHaveLength(16);
  });

  it('все цвета уникальны', () => {
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
  });

  it('все цвета — hex в формате #rrggbb', () => {
    for (const color of PALETTE) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('pickColor', () => {
  it('для первого пользователя берёт первый цвет палитры', () => {
    expect(pickColor([])).toBe(PALETTE[0]);
  });

  it('выдаёт первые 16 пользователям разные цвета', () => {
    const used: string[] = [];
    for (let i = 0; i < PALETTE.length; i += 1) {
      used.push(pickColor(used));
    }
    expect(new Set(used).size).toBe(PALETTE.length);
  });

  it('после полного круга начинает заново с первого цвета', () => {
    expect(pickColor([...PALETTE])).toBe(PALETTE[0]);
  });

  it('выбирает наименее используемый цвет', () => {
    const used = PALETTE.filter((_, index) => index !== 5);
    expect(pickColor(used)).toBe(PALETTE[5]);
  });

  it('игнорирует цвета вне палитры', () => {
    expect(pickColor(['#123456', '#123456'])).toBe(PALETTE[0]);
  });

  it('детерминирован', () => {
    const used = [PALETTE[0]!, PALETTE[0]!, PALETTE[1]!];
    expect(pickColor(used)).toBe(pickColor(used));
    expect(pickColor(used)).toBe(PALETTE[2]);
  });
});
