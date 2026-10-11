import type {FastifyRequest} from 'fastify';
import {JwtService, type JwtPayload} from '../core/jwt.service.js';
import {TokenBlacklistService} from '../cache/token.blacklist.service.js';
import {InvalidTokenError, AccessDeniedError} from '../core/errors.js';

async function extractAndVerifyToken(
  request: FastifyRequest,
): Promise<JwtPayload> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

  try {
    const payload = JwtService.verifyToken(token);
    (request as FastifyRequest & {user: JwtPayload}).user = payload;
    return payload;
  } catch {
    throw new InvalidTokenError('Invalid or expired JWT token');
  }
}

export const verifyTokenHook = (requiredRoles: string[] = []) => {
  return async (request: FastifyRequest) => {
    const payload = await extractAndVerifyToken(request);

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
