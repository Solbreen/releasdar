import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { Db } from './db.js';
import type { AppConfig } from './config.js';
import { ApiError } from './errors.js';
import { registerReleaseRoutes } from './routes/releases.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerStatic } from './static.js';

export interface AppDeps {
  db: Db;
  config: AppConfig;
}

export interface BuildAppOptions {
  /** Отдавать ли собранную статику SPA (в тестах и в dev не нужно). */
  serveStatic?: boolean;
  logger?: FastifyServerOptions['logger'];
}

const BODY_LIMIT = 64 * 1024;

export async function buildApp(
  deps: AppDeps,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: BODY_LIMIT,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.user ? { user: error.user } : {}),
        },
      });
    }

    // Превышение лимита тела и прочие ошибки самого Fastify.
    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 500;
    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: { code: 'VALIDATION_ERROR', message: 'Некорректный запрос' },
      });
    }

    request.log.error({ err: error }, 'Необработанная ошибка запроса');
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' },
    });
  });

  registerHealthRoutes(app);
  registerReleaseRoutes(app, deps);

  // Обработчик 404 регистрируется один раз: либо отдаёт SPA, либо JSON-ошибку.
  if (options.serveStatic) {
    await registerStatic(app);
  } else {
    app.setNotFoundHandler((request, reply) =>
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: request.url.startsWith('/api/') ? 'Метод не найден' : 'Страница не найдена',
        },
      }),
    );
  }

  return app;
}
