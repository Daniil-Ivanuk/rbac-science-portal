import type {FastifyRequest} from 'fastify';
import {JwtService, type JwtPayload} from '../core/jwt.service.js';
import {TokenBlacklistService} from '../cache/token.blacklist.service.js';
import {InvalidTokenError, AccessDeniedError} from '../core/errors.js';

export interface HttpRequestLike {
  headers: {
    authorization?: string | string[] | undefined;
    [key: string]: unknown;
  };
  user?: unknown;
}

export interface HttpResponseLike {
  status(code: number): this;
  json(body: unknown): this;
  send?(body: unknown): this;
}

export type NextFunctionLike = (err?: unknown) => void;

export async function authenticateRequest(
  request: HttpRequestLike,
  requiredRoles: string[] = [],
): Promise<JwtPayload> {
  const rawHeader = request.headers.authorization;
  const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

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

  let payload: JwtPayload;
  try {
    payload = JwtService.verifyToken(token);
    request.user = payload;
  } catch {
    throw new InvalidTokenError('Invalid or expired JWT token');
  }

  if (requiredRoles.length > 0) {
    const hasRole = requiredRoles.some((role) => payload.roles.includes(role));

    if (!hasRole) {
      throw new AccessDeniedError(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }
  }

  return payload;
}

export const verifyTokenHook = (requiredRoles: string[] = []) => {
  return async (request: FastifyRequest) => {
    await authenticateRequest(request, requiredRoles);
  };
};

export const expressAuthMiddleware = (requiredRoles: string[] = []) => {
  return async (
    req: HttpRequestLike,
    res: HttpResponseLike,
    next: NextFunctionLike,
  ) => {
    try {
      await authenticateRequest(req, requiredRoles);
      next();
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        res.status(error.statusCode || 401).json({error: error.message});
        return;
      }
      if (error instanceof AccessDeniedError) {
        res.status(error.statusCode || 403).json({error: error.message});
        return;
      }
      next(error);
    }
  };
};
