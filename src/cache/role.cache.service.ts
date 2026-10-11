import {prisma} from '../db/prisma.client.js';
import {redisClient} from './redis.client.js';

export class RoleCacheService {
  static async syncRolesToCache() {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    for (const role of roles) {
      const permissionNames = role.permissions.map((rp) => rp.permission.name);

      await redisClient.set(
        `role:${role.name}`,
        JSON.stringify(permissionNames),
      );
    }
  }

  static async getRolePermissions(roleName: string): Promise<string[]> {
    const cached = await redisClient.get(`role:${roleName}`);
    if (!cached) {
      return [];
    }
    try {
      return JSON.parse(cached);
    } catch {
      return [];
    }
  }
}
