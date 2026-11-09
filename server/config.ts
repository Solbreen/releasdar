export interface AppConfig {
  port: number;
  dbPath: string;
  vacationYear: number;
  adminLogin: string;
  adminPassword: string;
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
  const adminLogin = process.env.ADMIN_LOGIN?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminLogin || !adminPassword?.trim()) throw new Error('Укажите ADMIN_LOGIN и ADMIN_PASSWORD в .env');
  return {
    adminLogin, adminPassword,
    port: intFromEnv('PORT', 3000),
    dbPath: process.env.DB_PATH?.trim() || './data/vacations.db',
    vacationYear: intFromEnv('VACATION_YEAR', 2027),
  };
}
