/** Длина имени и фамилии по отдельности после trim и схлопывания пробелов. */
export const NAME_PART_MIN_LENGTH = 1;
export const NAME_PART_MAX_LENGTH = 30;

/**
 * Приводит часть имени к виду, в котором она хранится:
 * обрезает края и схлопывает любые последовательности пробельных символов в один пробел.
 * Дефис сохраняется как есть — двойные фамилии пишутся через него.
 */
export function normalizeNamePart(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Отображаемое имя: «Имя Фамилия». */
export function buildDisplayName(firstName: string, lastName: string): string {
  return `${normalizeNamePart(firstName)} ${normalizeNamePart(lastName)}`;
}

/**
 * Ключ для поиска пользователя: «Имя Фамилия» → нижний регистр → ё заменяется на е.
 * Два пользователя считаются одним и тем же тогда и только тогда,
 * когда совпадают их name_key.
 */
export function nameKey(firstName: string, lastName: string): string {
  return buildDisplayName(firstName, lastName).toLowerCase().replace(/ё/g, 'е');
}
