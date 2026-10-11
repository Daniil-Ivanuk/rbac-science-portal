import type {Redis} from 'ioredis';
import type {PrismaClient} from '@prisma/client';

export type {JwtPayload} from './core/jwt.service.js';

export {JwtService} from './core/jwt.service.js';
export {RoleService} from './core/role.service.js';
export {RoleCacheService} from './cache/role.cache.service.js';
export {TokenBlacklistService} from './cache/token.blacklist.service.js';

export {
  RbacError,
  InvalidTokenError,
  AccessDeniedError,
  RoleNotFoundError,
} from './core/errors.js';

export {verifyTokenHook} from './http/auth.hook.js';

export class RbacContext {
  static jwtSecret: string;
  static redis: Redis;
  static db: PrismaClient;
  static isInitialized: boolean = false;
}

export interface RbacModuleConfig {
  jwtSecret: string;
  redisClient: Redis;
  dbClient: PrismaClient;
}

export const initRbacModule = async (config: RbacModuleConfig) => {
  console.log('[RBAC Module] Начало инициализации...');

  if (!config.jwtSecret) {
    throw new Error('[RBAC Module] Ошибка: не передан jwtSecret.');
  }
  if (!config.redisClient) {
    throw new Error(
      '[RBAC Module] Ошибка: не передан инстанс Redis (ioredis).',
    );
  }
  if (!config.dbClient) {
    throw new Error(
      '[RBAC Module] Ошибка: не передан инстанс БД (PrismaClient).',
    );
  }

  RbacContext.jwtSecret = config.jwtSecret;
  RbacContext.redis = config.redisClient;
  RbacContext.db = config.dbClient;
  RbacContext.isInitialized = true;

  try {
    // Внимание: внутри RoleCacheService теперь нужно использовать RbacContext.db и RbacContext.redis,
    // а не импортировать их из локальных файлов модуля.
    const {RoleCacheService} = await import('./cache/role.cache.service.js');
    await RoleCacheService.syncRolesToCache();

    console.log('[RBAC Module] Успешно инициализирован: роли загружены в кэш.');
  } catch (error) {
    console.error(
      '[RBAC Module] Критическая ошибка при синхронизации кэша ролей:',
      error,
    );
    throw error;
  }
};
