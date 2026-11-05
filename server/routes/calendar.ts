import type { FastifyInstance } from 'fastify';
import { listCalendarUsers } from '../repo.js';
import type { AppDeps } from '../app.js';

export function registerCalendarRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/calendar', async () => ({
    year: deps.config.vacationYear,
    users: listCalendarUsers(deps.db),
  }));
}
