import {PrismaClient} from '@prisma/client';
import {redisClient} from './redis.client.js';

const prisma = new PrismaClient();

export class RoleCacheService {
  /**
   * Выгружает все активные роли из SQL Server и сохраняет их в Redis
   */
  static async syncRolesToCache(): Promise<void> {
    try {
      // 1. Получаем роли из базы через Prisma
      const roles = await prisma.role.findMany({
        where: {isActive: true},
        select: {name: true, permissions: true},
      });

      if (roles.length === 0) {
        console.warn('В базе данных не найдено активных ролей.');
        return;
      }

      // 2. Используем pipeline (транзакцию) Redis для массовой записи
      const pipeline = redisClient.pipeline();

      for (const role of roles) {
        // Ключ будет выглядеть как "role:admin"
        pipeline.set(`role:${role.name}`, role.permissions);
      }

      // 3. Выполняем запись
      await pipeline.exec();
      console.log(`Успешно загружено ${roles.length} ролей в кэш Redis.`);
    } catch (error) {
      console.error('Ошибка при синхронизации ролей с Redis:', error);
      throw error;
    }
  }

  /**
   * Получает права для конкретной роли из кэша
   */
  static async getRolePermissions(roleName: string): Promise<string[] | null> {
    const permissionsJson = await redisClient.get(`role:${roleName}`);
    if (!permissionsJson) {
      return null;
    }
    return JSON.parse(permissionsJson);
  }
}
