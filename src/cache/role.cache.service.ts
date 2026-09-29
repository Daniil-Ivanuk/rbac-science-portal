import {prisma} from '../db/prisma.client.js';
import {redisClient} from './redis.client.js';

export class RoleCacheService {
  /**
   * Синхронизирует все роли и их права из базы данных SQL Server в кэш Redis
   */
  static async syncRolesToCache() {
    // 1. Достаем все роли и связанные с ними права через промежуточную таблицу
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true, // Включаем саму сущность Permission
          },
        },
      },
    });

    // 2. Формируем кэш и записываем в Redis
    for (const role of roles) {
      // Вытаскиваем названия прав из промежуточной таблицы RolePermission
      const permissionNames = role.permissions.map((rp) => rp.permission.name);

      // Кэшируем массив строк (названий прав) по ключу роли
      await redisClient.set(
        `role:${role.name}`,
        JSON.stringify(permissionNames),
      );
    }
  }

  /**
   * Получает права для указанной роли из кэша Redis
   */
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
