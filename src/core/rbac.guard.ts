import type {JwtPayload} from './jwt.service.js';
import {RoleCacheService} from '../cache/role.cache.service.js';

export class RbacGuard {
  /**
   * Асинхронная проверка прав через Redis-кэш.
   * Игнорирует права внутри токена, доверяет только базе данных.
   */
  public static async hasPermission(
    user: JwtPayload,
    requiredPermission: string,
  ): Promise<boolean> {
    // Проходим по всем ролям пользователя из его токена
    for (const role of user.roles) {
      // Достаем свежие права для конкретной роли из кэша
      const cachedPermissions = await RoleCacheService.getRolePermissions(role);

      // Если права найдены и требуемое право есть в списке — разрешаем доступ
      if (cachedPermissions && cachedPermissions.includes(requiredPermission)) {
        return true;
      }
    }

    // Если ни одна роль не дала нужного права — отказываем
    return false;
  }

  /**
   * Проверка наличия хотя бы одной роли из разрешенного списка.
   * (Остается синхронной, так как проверяет только то, что зашито в самом токене).
   */
  public static hasRole(user: JwtPayload, allowedRoles: string[]): boolean {
    return user.roles.some((role) => allowedRoles.includes(role));
  }
}
