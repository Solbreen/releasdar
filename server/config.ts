export interface AppConfig {
  port: number;
  dbPath: string;
  vacationYear: number;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Переменная окружения ${name} должна быть целым числом, получено: ${raw}`);
  }
  return parsed;
}

export function loadConfig(): AppConfig {
  return {
    port: intFromEnv('PORT', 3000),
    dbPath: process.env.DB_PATH?.trim() || './data/vacations.db',
    vacationYear: intFromEnv('VACATION_YEAR', 2027),
  };
}
