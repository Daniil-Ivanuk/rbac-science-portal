import {redisClient} from './redis.client.js';

const ROLE_PERMISSIONS_TTL = 600;

export class RbacCacheService {
  private static getRoleKey(roleName: string): string {
    return `rbac:role:${roleName}:permissions`;
  }

  public static async getPermissionsForRole(
    roleName: string,
  ): Promise<string[] | null> {
    const data = await redisClient.get(this.getRoleKey(roleName));
    if (!data) return null;
    return JSON.parse(data) as string[];
  }

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

  public static async invalidateRole(roleName: string): Promise<void> {
    await redisClient.del(this.getRoleKey(roleName));
  }
}
