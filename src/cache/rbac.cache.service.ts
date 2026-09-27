import {redisClient} from './redis.client.js';

const ROLE_PERMISSIONS_TTL = 600; // 10 минут в секундах

export class RbacCacheService {
  // Ключ для хранения прав роли в Redis
  private static getRoleKey(roleName: string): string {
    return `rbac:role:${roleName}:permissions`;
  }

  // Получить кэшированные права роли
  public static async getPermissionsForRole(
    roleName: string,
  ): Promise<string[] | null> {
    const data = await redisClient.get(this.getRoleKey(roleName));
    if (!data) return null;
    return JSON.parse(data) as string[];
  }

  // Сохранить права роли в кэш
  public static async setPermissionsForRole(
    roleName: string,
    permissions: string[],
  ): Promise<void> {
    await redisClient.setex(
      this.getRoleKey(roleName),
      ROLE_PERMISSIONS_TTL,
      JSON.stringify(permissions),
    );
  }

  // Инвалидация (сброс) кэша при изменении прав в базе
  public static async invalidateRole(roleName: string): Promise<void> {
    await redisClient.del(this.getRoleKey(roleName));
  }
}
