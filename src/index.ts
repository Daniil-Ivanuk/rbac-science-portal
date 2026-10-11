export type {JwtPayload} from './core/jwt.service.js';
import {RoleCacheService} from './cache/role.cache.service.js';
export {RoleCacheService};
export {JwtService} from './core/jwt.service.js';
export {RoleService} from './core/role.service.js';
export {TokenBlacklistService} from './cache/token.blacklist.service.js';
export {
  RbacError,
  InvalidTokenError,
  AccessDeniedError,
  RoleNotFoundError,
} from './core/errors.js';

export {verifyTokenHook} from './http/auth.hook.js';
export const initRbacModule = async () => {
  console.log('[RBAC Module] Инициализация...');

  await RoleCacheService.syncRolesToCache();

  console.log('[RBAC Module] Успешно инициализирован: роли загружены в кэш.');
};
