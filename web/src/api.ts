import type { ApiErrorBody, CalendarDto, UserDto } from '../../shared/types.js';

/** Ошибка, пришедшая от API вместе с кодом. */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly user?: UserDto;

  constructor(status: number, code: string, message: string, user?: UserDto) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.user = user;
  }
}

/** Сетевая ошибка или недоступный сервер. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Нет связи с сервером');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch (error) {
    throw new NetworkError(error);
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (response.ok) throw new NetworkError(error);
    throw new ApiRequestError(response.status, 'INTERNAL_ERROR', 'Сервер вернул некорректный ответ');
  }

  if (!response.ok) {
    const body = payload as ApiErrorBody;
    const error = body?.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Неизвестная ошибка',
      error?.user,
    );
  }

  return payload as T;
}

export const api = {
  login(firstName: string, lastName: string): Promise<{ user: UserDto; created: boolean }> {
    return request('/api/users', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName }),
    });
  },

  getUser(id: number): Promise<{ user: UserDto }> {
    return request(`/api/users/${id}`);
  },

  getCalendar(): Promise<CalendarDto> {
    return request('/api/calendar');
  },

  saveDays(id: number, dates: string[], version: number): Promise<{ user: UserDto }> {
    return request(`/api/users/${id}/days`, {
      method: 'PUT',
      body: JSON.stringify({ dates, version }),
    });
  },

  rename(id: number, firstName: string, lastName: string): Promise<{ user: UserDto }> {
    return request(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ firstName, lastName }),
    });
  },

  remove(id: number): Promise<void> {
    return request(`/api/users/${id}`, { method: 'DELETE' });
  },
};
