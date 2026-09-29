import type {FastifyRequest, FastifyReply} from 'fastify';
import {JwtService, type JwtPayload} from '../core/jwt.service.js';
import {TokenBlacklistService} from '../cache/token.blacklist.service.js';
// 1. Импортируем кастомные ошибки
import {InvalidTokenError, AccessDeniedError} from '../core/errors.js';

// 2. Делаем функцию фабрикой, принимающей массив разрешенных ролей
export const verifyTokenHook = (requiredRoles: string[] = []) => {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // 3. Выбрасываем исключения вместо ручной отправки ответа
      throw new InvalidTokenError(
        'Отсутствует или некорректен заголовок Authorization',
      );
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new InvalidTokenError('Токен не найден');
    }

    const isBlacklisted = await TokenBlacklistService.isBlacklisted(token);
    if (isBlacklisted) {
      throw new InvalidTokenError('Сессия завершена (токен в черном списке)');
    }

    let payload: JwtPayload;
    try {
      payload = JwtService.verifyToken(token);
      (request as FastifyRequest & {user: JwtPayload}).user = payload;
    } catch {
      throw new InvalidTokenError('Недействительный или просроченный токен');
    }

    // 4. Проверяем наличие нужной роли (основа RBAC)
    if (requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((role) =>
        payload.roles.includes(role),
      );
      if (!hasRole) {
        throw new AccessDeniedError(
          `Доступ запрещен. Требуются роли: ${requiredRoles.join(', ')}`,
        );
      }
    }
  };
};
