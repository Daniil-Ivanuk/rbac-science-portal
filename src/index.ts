import type {Redis} from 'ioredis';
import type {PrismaClient} from '@prisma/client';
import {RbacContext} from './core/context.js';

export type {JwtPayload} from './core/jwt.service.js';

export {RbacContext};
export {JwtService} from './core/jwt.service.js';
export {RoleService} from './core/role.service.js';
export {
  AuthService,
  type RegisterInput,
  type LoginResult,
} from './core/auth.service.js';
export {ArticleService} from './core/article.service.js';
export {RbacGuard} from './core/rbac.guard.js';
export {hashPassword, verifyPassword} from './core/security.js';
export {RoleCacheService} from './cache/role.cache.service.js';
export {TokenBlacklistService} from './cache/token.blacklist.service.js';

export {
  UserRepository,
  RoleRepository,
  PermissionRepository,
  ArticleRepository,
  type UserRecord,
  type UserStoreRecord,
  type CreateUserInput,
  type UserAccessConfig,
  type RoleRecord,
  type RoleWithPermissions,
  type PermissionRecord,
  type ArticleRecord,
  type CreateArticleInput,
  type UpdateArticleInput,
} from './repositories/index.js';

export {
  RbacError,
  ValidationError,
  InvalidTokenError,
  AccessDeniedError,
  RoleNotFoundError,
  EntityNotFoundError,
  ConflictError,
} from './core/errors.js';

export {
  verifyTokenHook,
  expressAuthMiddleware,
  authenticateRequest,
  type HttpRequestLike,
  type HttpResponseLike,
  type NextFunctionLike,
} from './http/auth.hook.js';

export interface RbacModuleConfig {
  jwtSecret: string;
  redisClient: Redis;
  dbClient: PrismaClient;
}

export const initRbacModule = async (config: RbacModuleConfig) => {
  console.log('[RBAC Module] Starting initialization...');

  if (!config.jwtSecret) {
    throw new Error('[RBAC Module] Error: jwtSecret is required.');
  }
  if (!config.redisClient) {
    throw new Error(
      '[RBAC Module] Error: Redis (ioredis) instance is required.',
    );
  }
  if (!config.dbClient) {
    throw new Error(
      '[RBAC Module] Error: DB (PrismaClient) instance is required.',
    );
  }

  RbacContext.jwtSecret = config.jwtSecret;
  RbacContext.redis = config.redisClient;
  RbacContext.db = config.dbClient;
  RbacContext.isInitialized = true;

  try {
    const {RoleCacheService} = await import('./cache/role.cache.service.js');
    await RoleCacheService.syncRolesToCache();

    console.log(
      '[RBAC Module] Successfully initialized: roles loaded into cache.',
    );
  } catch (error) {
    console.warn(
      '[RBAC Module] Warning: Initial role cache synchronization encountered an issue. Fallback to direct DB queries active:',
      error,
    );
  }
};
