import type {FastifyRequest} from 'fastify';
import {JwtService, type JwtPayload} from '../core/jwt.service.js';
import {TokenBlacklistService} from '../cache/token.blacklist.service.js';
import {InvalidTokenError, AccessDeniedError} from '../core/errors.js';

async function extractAndVerifyToken(
  request: FastifyRequest,
): Promise<JwtPayload> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new InvalidTokenError('Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    throw new InvalidTokenError('Token not found');
  }

  const isBlacklisted = await TokenBlacklistService.isBlacklisted(token);
  if (isBlacklisted) {
    throw new InvalidTokenError('Session terminated (token is blacklisted)');
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
          `Access denied. Required roles: ${requiredRoles.join(', ')}`,
        );
      }
    }
  };
};
