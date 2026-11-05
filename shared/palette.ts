/**
 * 16 различимых цветов средней насыщенности — читаются и на светлом, и на тёмном фоне.
 */
export const PALETTE: readonly string[] = [
  '#e4572e',
  '#f4a259',
  '#d4a017',
  '#8cb369',
  '#3f9b57',
  '#2a9d8f',
  '#4cc9c0',
  '#3a86ff',
  '#5a6cd8',
  '#7b5ea7',
  '#a663cc',
  '#d65db1',
  '#e36387',
  '#c9485b',
  '#8d6e63',
  '#6b8e9e',
];

/**
 * Выбирает наименее используемый цвет палитры. При равном счёте выигрывает
 * цвет, который раньше стоит в палитре, — так первые пользователи получают
 * максимально разные цвета, а результат остаётся детерминированным.
 */
export function pickColor(usedColors: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const color of PALETTE) counts.set(color, 0);
  for (const used of usedColors) {
    const current = counts.get(used);
    if (current !== undefined) counts.set(used, current + 1);
  }
  let best = PALETTE[0]!;
  let bestCount = Number.POSITIVE_INFINITY;
  for (const color of PALETTE) {
    const count = counts.get(color)!;
    if (count < bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}
