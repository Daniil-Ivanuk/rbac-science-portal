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

      if (!RbacContext.redis) return;

      for (const role of roles) {
        const permissionNames = role.permissions.map(
          (rp: {permission: {name: string}}) => rp.permission.name,
        );

        try {
          await RbacContext.redis.set(
            `role:${role.name}`,
            JSON.stringify(permissionNames),
          );
        } catch (redisError) {
          console.warn(
            `[RoleCacheService] Failed to cache role "${role.name}" in Redis:`,
            redisError instanceof Error ? redisError.message : redisError,
          );
        }
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

    let cached: string | null = null;
    let isRedisAvailable = false;

    if (RbacContext.redis) {
      try {
        cached = await RbacContext.redis.get(`role:${roleName}`);
        isRedisAvailable = true;
      } catch (error) {
        console.warn(
          `[RoleCacheService] Redis unavailable while reading role "${roleName}":`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.error(
          `[RoleCacheService] Error parsing cache for role ${roleName}:`,
          error,
        );
      }
    }

    if (!RbacContext.db) {
      return [];
    }

    try {
      const role = await RbacContext.db.role.findUnique({
        where: {name: roleName},
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      if (!role) {
        return [];
      }

      const permissions = role.permissions.map(
        (rp: {permission: {name: string}}) => rp.permission.name,
      );

      if (isRedisAvailable && RbacContext.redis) {
        try {
          await RbacContext.redis.set(
            `role:${role.name}`,
            JSON.stringify(permissions),
          );
        } catch {
          // ignore cache warming error
        }
      }

      return permissions;
    } catch (dbError) {
      console.error(
        `[RoleCacheService] Fallback to DB failed for role "${roleName}":`,
        dbError,
      );
      return [];
    }
  }

  static async invalidateRoleCache(roleName: string): Promise<void> {
    if (!RbacContext.isInitialized || !RbacContext.redis) return;

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
    if (!RbacContext.isInitialized || !RbacContext.redis) return;

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
