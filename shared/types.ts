/** Пользователь в ответах API. */
export interface UserDto {
  id: number;
  firstName: string;
  lastName: string;
  /** Всегда «{firstName} {lastName}» — вычисляется, отдельно не хранится. */
  displayName: string;
  color: string;
  version: number;
  days: string[];
}

/**
 * Пользователь в ответе /api/calendar.
 * dayCount — засчитанные дни отпуска: праздники в него не входят.
 */
export interface CalendarUserDto extends UserDto {
  dayCount: number;
}

export interface CalendarDto {
  year: number;
  users: CalendarUserDto[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    /** Для VERSION_CONFLICT — актуальное состояние пользователя. */
    user?: UserDto;
    details?: unknown;
  };
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'USER_NOT_FOUND'
  | 'NAME_TAKEN'
  | 'VERSION_CONFLICT'
  | 'INVALID_DATE'
  | 'INTERNAL_ERROR';
