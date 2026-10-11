import {RbacContext} from '../index.js';

export class RoleCacheService {
  static async syncRolesToCache(): Promise<void> {
    if (!RbacContext.isInitialized) {
      throw new Error(
        '[RBAC Module] Попытка синхронизации кэша до инициализации модуля.',
      );
    }

    try {
      const roles = await RbacContext.db.role.findMany({
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      for (const role of roles) {
        const permissionNames = role.permissions.map(
          (rp: any) => rp.permission.name,
        );

        await RbacContext.redis.set(
          `role:${role.name}`,
          JSON.stringify(permissionNames),
        );
      }
    } catch (error) {
      console.error('[RoleCacheService] Ошибка при чтении ролей из БД:', error);
      throw error;
    }
  }

  static async getRolePermissions(roleName: string): Promise<string[]> {
    if (!RbacContext.isInitialized) {
      return [];
    }

    try {
      const cached = await RbacContext.redis.get(`role:${roleName}`);
      if (!cached) {
        return [];
      }
      return JSON.parse(cached);
    } catch (error) {
      console.error(
        `[RoleCacheService] Ошибка при парсинге кэша для роли ${roleName}:`,
        error,
      );
      return [];
    }
  }

  static async invalidateRoleCache(roleName: string): Promise<void> {
    if (!RbacContext.isInitialized) return;

    try {
      await RbacContext.redis.del(`role:${roleName}`);
    } catch (error) {
      console.error(
        `[RoleCacheService] Ошибка инвалидации кэша для роли ${roleName}:`,
        error,
      );
    }
  }

  static async updateRoleCache(
    roleName: string,
    permissions: string[],
  ): Promise<void> {
    if (!RbacContext.isInitialized) return;

    try {
      await RbacContext.redis.set(
        `role:${roleName}`,
        JSON.stringify(permissions),
      );
    } catch (error) {
      console.error(
        `[RoleCacheService] Ошибка обновления кэша для роли ${roleName}:`,
        error,
      );
    }
  }
}
