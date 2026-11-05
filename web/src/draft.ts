/**
 * Локальный черновик дней текущего пользователя.
 *
 * saved — то, что лежит на сервере; added и removed — несохранённая разница.
 * Структура неизменяемая: каждая операция возвращает новый объект,
 * поэтому её удобно держать в состоянии React и тестировать как чистые функции.
 */
export interface Draft {
  saved: ReadonlySet<string>;
  added: ReadonlySet<string>;
  removed: ReadonlySet<string>;
}

export function createDraft(savedDays: Iterable<string>): Draft {
  return { saved: new Set(savedDays), added: new Set(), removed: new Set() };
}

/** Отмечен ли день с учётом несохранённых изменений. */
export function isSelected(draft: Draft, date: string): boolean {
  if (draft.added.has(date)) return true;
  if (draft.removed.has(date)) return false;
  return draft.saved.has(date);
}

export type DayDraftState = 'empty' | 'saved' | 'added' | 'removed';

/** Состояние дня для отрисовки ячейки календаря. */
export function dayState(draft: Draft, date: string): DayDraftState {
  if (draft.added.has(date)) return 'added';
  if (draft.removed.has(date)) return 'removed';
  return draft.saved.has(date) ? 'saved' : 'empty';
}

function withDay(draft: Draft, date: string, selected: boolean): Draft {
  const added = new Set(draft.added);
  const removed = new Set(draft.removed);
  const wasSaved = draft.saved.has(date);

  if (selected) {
    removed.delete(date);
    if (!wasSaved) added.add(date);
  } else {
    added.delete(date);
    if (wasSaved) removed.add(date);
  }

  return { saved: draft.saved, added, removed };
}

/** Переключает один день. */
export function toggleDay(draft: Draft, date: string): Draft {
  return withDay(draft, date, !isSelected(draft, date));
}

/** Приводит один день к заданному состоянию. */
export function setDay(draft: Draft, date: string, selected: boolean): Draft {
  return withDay(draft, date, selected);
}

/**
 * Выделение диапазона по Shift: все дни от anchor до target включительно
 * приводятся к тому состоянию, в котором находится anchor.
 * Порядок кликов не важен — границы нормализуются.
 */
export function toggleRange(
  draft: Draft,
  anchor: string,
  target: string,
  allDates: readonly string[],
): Draft {
  const [from, to] = anchor <= target ? [anchor, target] : [target, anchor];
  const selected = isSelected(draft, anchor);

  let next = draft;
  for (const date of allDates) {
    if (date < from) continue;
    if (date > to) break;
    next = withDay(next, date, selected);
  }
  return next;
}

/** Количество несохранённых изменений. */
export function changeCount(draft: Draft): number {
  return draft.added.size + draft.removed.size;
}

export function hasChanges(draft: Draft): boolean {
  return changeCount(draft) > 0;
}

/** Итоговый набор дней для отправки на сервер — отсортированный. */
export function effectiveDays(draft: Draft): string[] {
  const result = new Set(draft.saved);
  for (const date of draft.removed) result.delete(date);
  for (const date of draft.added) result.add(date);
  return [...result].sort();
}

/** Отбрасывает несохранённые изменения. */
export function resetDraft(draft: Draft): Draft {
  return { saved: draft.saved, added: new Set(), removed: new Set() };
}

/**
 * Подменяет базу черновика свежими данными сервера, сохраняя локальную разницу:
 * дни, которые уже появились на сервере, перестают считаться добавленными,
 * а удаление дня, которого на сервере больше нет, забывается.
 */
export function rebaseDraft(draft: Draft, savedDays: Iterable<string>): Draft {
  const saved = new Set(savedDays);
  const added = new Set<string>();
  for (const date of draft.added) {
    if (!saved.has(date)) added.add(date);
  }
  const removed = new Set<string>();
  for (const date of draft.removed) {
    if (saved.has(date)) removed.add(date);
  }
  return { saved, added, removed };
}
