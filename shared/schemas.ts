import { z } from 'zod';
import { NAME_PART_MAX_LENGTH, NAME_PART_MIN_LENGTH, normalizeNamePart } from './name.js';
import { isDateInYear, isValidIsoDate } from './dates.js';

/**
 * Имя или фамилия. Нормализация (trim + схлопывание пробелов) выполняется
 * в самой схеме, поэтому дальше по коду всегда приходит готовая к показу форма.
 */
function namePartSchema(messages: { empty: string; type: string; tooLong: string }) {
  return z
    .string({ error: (issue) => (issue.input === undefined ? messages.empty : messages.type) })
    .transform(normalizeNamePart)
    .refine((value) => value.length >= NAME_PART_MIN_LENGTH, { error: messages.empty })
    .refine((value) => value.length <= NAME_PART_MAX_LENGTH, { error: messages.tooLong });
}

export const firstNameSchema = namePartSchema({
  empty: 'Укажите имя',
  type: 'Имя должно быть строкой',
  tooLong: `Имя не длиннее ${NAME_PART_MAX_LENGTH} символов`,
});

export const lastNameSchema = namePartSchema({
  empty: 'Укажите фамилию',
  type: 'Фамилия должна быть строкой',
  tooLong: `Фамилия не длиннее ${NAME_PART_MAX_LENGTH} символов`,
});

/** Тело запросов входа и переименования. */
export const personNameSchema = z.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
});
export type PersonNameBody = z.infer<typeof personNameSchema>;

export const userIdParamsSchema = z.object({
  id: z.coerce
    .number({ error: 'Некорректный идентификатор пользователя' })
    .int('Некорректный идентификатор пользователя')
    .positive('Некорректный идентификатор пользователя'),
});
export type UserIdParams = z.infer<typeof userIdParamsSchema>;

/** Строка формата YYYY-MM-DD, обозначающая реально существующую дату. */
export const isoDateSchema = z
  .string({ error: 'Дата должна быть строкой' })
  .refine(isValidIsoDate, { error: 'Некорректная дата' });

/** Схема тела PUT /api/users/:id/days — год подставляется из конфигурации. */
export function createSaveDaysSchema(year: number) {
  return z.object({
    dates: z.array(
      z
        .string({ error: 'Дата должна быть строкой' })
        .refine((value) => isDateInYear(value, year), {
          error: `Дата должна быть корректной датой ${year} года`,
        }),
      {
        error: (issue) =>
          issue.input === undefined ? 'Не передан список дат' : 'Список дат должен быть массивом',
      },
    ),
    version: z
      .number({
        error: (issue) =>
          issue.input === undefined ? 'Не передана версия' : 'Версия должна быть числом',
      })
      .int('Версия должна быть целым числом')
      .min(0, 'Версия не может быть отрицательной'),
  });
}

export type SaveDaysBody = z.infer<ReturnType<typeof createSaveDaysSchema>>;
