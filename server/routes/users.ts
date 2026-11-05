import type { FastifyInstance } from 'fastify';
import {
  createSaveDaysSchema,
  personNameSchema,
  userIdParamsSchema,
} from '../../shared/schemas.js';
import { nameTaken, userNotFound, versionConflict } from '../errors.js';
import { parseOrThrow } from '../validate.js';
import {
  NameTakenError,
  deleteUser,
  getOrCreateUser,
  getUser,
  renameUser,
  saveDays,
} from '../repo.js';
import type { AppDeps } from '../app.js';

export function registerUserRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { db, config } = deps;
  const saveDaysSchema = createSaveDaysSchema(config.vacationYear);

  // Войти или создать пользователя по имени и фамилии.
  app.post('/api/users', async (request, reply) => {
    const { firstName, lastName } = parseOrThrow(personNameSchema, request.body);
    const { user, created } = getOrCreateUser(db, firstName, lastName);
    return reply.status(created ? 201 : 200).send({ user, created });
  });

  app.get('/api/users/:id', async (request) => {
    const { id } = parseOrThrow(userIdParamsSchema, request.params);
    const user = getUser(db, id);
    if (!user) throw userNotFound();
    return { user };
  });

  // Полная замена набора дней с оптимистичной блокировкой по version.
  app.put('/api/users/:id/days', async (request) => {
    const { id } = parseOrThrow(userIdParamsSchema, request.params);
    const body = parseOrThrow(saveDaysSchema, request.body, [['dates', 'INVALID_DATE']]);
    const unique = [...new Set(body.dates)].sort();

    const result = saveDays(db, id, unique, body.version);
    if (result.status === 'not_found') throw userNotFound();
    if (result.status === 'conflict') throw versionConflict(result.user);
    return { user: result.user };
  });

  app.patch('/api/users/:id', async (request) => {
    const { id } = parseOrThrow(userIdParamsSchema, request.params);
    const { firstName, lastName } = parseOrThrow(personNameSchema, request.body);
    try {
      const user = renameUser(db, id, firstName, lastName);
      if (!user) throw userNotFound();
      return { user };
    } catch (error) {
      if (error instanceof NameTakenError) throw nameTaken();
      throw error;
    }
  });

  app.delete('/api/users/:id', async (request, reply) => {
    const { id } = parseOrThrow(userIdParamsSchema, request.params);
    if (!deleteUser(db, id)) throw userNotFound();
    return reply.status(204).send();
  });
}
