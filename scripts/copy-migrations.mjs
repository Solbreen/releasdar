// Миграции — это .sql файлы, tsc их не копирует; переносим в dist вручную.
import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist/server/migrations', { recursive: true });
cpSync('server/migrations', 'dist/server/migrations', { recursive: true });
console.log('Миграции скопированы в dist/server/migrations');
