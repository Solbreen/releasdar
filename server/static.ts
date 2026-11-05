import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * В продакшене тот же процесс Fastify отдаёт собранный SPA.
 * Любой не-API путь отдаёт index.html, чтобы работала навигация на клиенте.
 */
export async function registerStatic(app: FastifyInstance): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/server/static.js → dist/web
  const root = resolve(here, '../web');
  if (!existsSync(join(root, 'index.html'))) {
    app.log.warn({ root }, 'Собранная статика не найдена, SPA отдаваться не будет');
    return;
  }

  // wildcard по умолчанию: файлы ищутся на диске при каждом запросе,
  // а не фиксируются снимком каталога на момент старта.
  await app.register(fastifyStatic, { root, index: 'index.html' });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Метод не найден' } });
    }
    return reply.sendFile('index.html');
  });
}
