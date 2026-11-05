import type { ApiErrorCode, UserDto } from '../shared/types.js';

/** Ошибка API: код, человекочитаемое сообщение на русском и HTTP-статус. */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly user?: UserDto;

  constructor(statusCode: number, code: ApiErrorCode, message: string, user?: UserDto) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.user = user;
  }
}

export const userNotFound = (): ApiError =>
  new ApiError(404, 'USER_NOT_FOUND', 'Пользователь не найден');

export const nameTaken = (): ApiError =>
  new ApiError(409, 'NAME_TAKEN', 'Это имя уже занято другим пользователем');

export const versionConflict = (user: UserDto): ApiError =>
  new ApiError(
    409,
    'VERSION_CONFLICT',
    'Ваши даты были изменены в другом месте, обновите данные',
    user,
  );
