import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { buildApp } from './app.js';
import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';

if (existsSync('.env')) loadEnvFile('.env');

const config = loadConfig();
const db = openDb(config.dbPath);

const app = await buildApp(
  { db, config },
  {
    serveStatic: process.env.NODE_ENV === 'production',
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
    },
  },
);

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'Останавливаем сервер');
  await app.close();
  db.close();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info({ year: config.vacationYear, dbPath: config.dbPath }, 'Сервис запущен');
} catch (error) {
  app.log.error({ err: error }, 'Не удалось запустить сервер');
  process.exit(1);
}
