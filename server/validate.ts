import type { z } from 'zod';
import { ApiError } from './errors.js';
import type { ApiErrorCode } from '../shared/types.js';

/**
 * Разбирает входные данные схемой Zod. При ошибке бросает ApiError 400
 * с сообщением первой проблемы. Код ошибки можно переопределить по пути поля —
 * так проблемы в массиве dates превращаются в INVALID_DATE.
 */
export function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  codeByPathPrefix: Array<[string, ApiErrorCode]> = [],
): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issue = result.error.issues[0]!;
  let code: ApiErrorCode = 'VALIDATION_ERROR';
  for (const [prefix, mapped] of codeByPathPrefix) {
    if (issue.path[0] === prefix) {
      code = mapped;
      break;
    }
  }
  throw new ApiError(400, code, issue.message);
}
