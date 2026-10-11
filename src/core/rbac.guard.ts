import type {JwtPayload} from './jwt.service.js';
import {RoleCacheService} from '../cache/role.cache.service.js';

export class RbacGuard {
  public static async hasPermission(
    user: JwtPayload,
    requiredPermission: string,
  ): Promise<boolean> {
    for (const role of user.roles) {
      const cachedPermissions = await RoleCacheService.getRolePermissions(role);

      if (cachedPermissions && cachedPermissions.includes(requiredPermission)) {
        return true;
      }
    }

    return false;
  }

  public static hasRole(user: JwtPayload, allowedRoles: string[]): boolean {
    return user.roles.some((role) => allowedRoles.includes(role));
  }
}
