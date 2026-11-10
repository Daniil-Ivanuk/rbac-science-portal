import {RbacContext} from '../index.js';

export class RoleCacheService {
  static async syncRolesToCache(): Promise<void> {
    if (!RbacContext.isInitialized) {
      throw new Error(
        '[RBAC Module] Attempted to synchronize cache before module initialization.',
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
          (rp: {permission: {name: string}}) => rp.permission.name,
        );

        await RbacContext.redis.set(
          `role:${role.name}`,
          JSON.stringify(permissionNames),
        );
      }
    } catch (error) {
      console.error('[RoleCacheService] Error reading roles from DB:', error);
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
        `[RoleCacheService] Error parsing cache for role ${roleName}:`,
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
        `[RoleCacheService] Error invalidating cache for role ${roleName}:`,
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
        `[RoleCacheService] Error updating cache for role ${roleName}:`,
        error,
      );
    }
  }
}
