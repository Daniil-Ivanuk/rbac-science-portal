import type {JwtPayload} from './jwt.service.js';

export class RbacGuard {
  // Проверка, есть ли у пользователя конкретное право (Permission)
  public static hasPermission(
    user: JwtPayload,
    requiredPermission: string,
  ): boolean {
    return user.permissions.includes(requiredPermission);
  }

  // Проверка наличия хотя бы одной роли из разрешенного списка
  public static hasRole(user: JwtPayload, allowedRoles: string[]): boolean {
    return user.roles.some((role) => allowedRoles.includes(role));
  }
}
