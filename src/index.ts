// 1. Экспорт типов
export type {JwtPayload} from './core/jwt.service.js';

// 2. Явный импорт сервисов, которые нужны внутри самого index.ts
import {RoleCacheService} from './cache/role.cache.service.js';

// Реэкспорт всех необходимых сервисов наружу
export {RoleCacheService};
export {JwtService} from './core/jwt.service.js';
export {RoleService} from './core/role.service.js';
export {TokenBlacklistService} from './cache/token.blacklist.service.js';
// Экспорт кастомных ошибок
export {
  RbacError,
  InvalidTokenError,
  AccessDeniedError,
  RoleNotFoundError,
} from './core/errors.js';

// 3. Экспорт хуков и middleware для Fastify
export {verifyTokenHook} from './http/auth.hook.js';

// 4. Функция инициализации модуля
export const initRbacModule = async () => {
  console.log('[RBAC Module] Инициализация...');

  await RoleCacheService.syncRolesToCache();

  console.log('[RBAC Module] Успешно инициализирован: роли загружены в кэш.');
};
