import {describe, it, expect, beforeEach, afterAll, jest} from '@jest/globals';
import {RbacCacheService} from '../src/cache/rbac.cache.service.js';
import {TokenBlacklistService} from '../src/cache/token.blacklist.service.js';
import {redisClient} from '../src/cache/redis.client.js';

// Инструкция для Jest: автоматически подменять 'ioredis' на 'ioredis-mock'
jest.mock('ioredis', () => {
  const RedisMock = require('ioredis-mock');
  return {
    __esModule: true,
    default: RedisMock,
    Redis: RedisMock,
  };
});

describe('Redis Cache and Blacklist Service Tests', () => {
  // Очищаем базу мока перед каждым тестом, чтобы они были независимыми
  beforeEach(async () => {
    await redisClient.flushall();
  });
  // Добавляем этот блок для чистого закрытия соединения
  afterAll(async () => {
    await redisClient.quit();
  });
  it('должен корректно сохранять и получать права роли из кэша Redis', async () => {
    const roleName = 'Researcher';
    const permissions = ['read:articles', 'create:articles'];

    // Проверяем, что до записи кэш пуст
    const cachedBefore = await RbacCacheService.getPermissionsForRole(roleName);
    expect(cachedBefore).toBeNull();

    // Записываем в кэш
    await RbacCacheService.setPermissionsForRole(roleName, permissions);

    // Проверяем, что права успешно достаются из кэша
    const cachedAfter = await RbacCacheService.getPermissionsForRole(roleName);
    expect(cachedAfter).toEqual(permissions);
  });

  it('должен корректно инвалидировать (сбрасывать) кэш роли', async () => {
    const roleName = 'Admin';
    const permissions = ['manage:users', 'delete:articles'];

    await RbacCacheService.setPermissionsForRole(roleName, permissions);
    expect(await RbacCacheService.getPermissionsForRole(roleName)).toEqual(
      permissions,
    );

    // Инвалидация кэша
    await RbacCacheService.invalidateRole(roleName);

    // После инвалидации данных быть не должно
    const cachedAfterInvalidation =
      await RbacCacheService.getPermissionsForRole(roleName);
    expect(cachedAfterInvalidation).toBeNull();
  });

  it('должен добавлять токен в черный список и корректно определять его статус', async () => {
    const sampleToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_token_payload';

    // До отзыва токен не должен быть в черном списке
    const isBlacklistedBefore =
      await TokenBlacklistService.isBlacklisted(sampleToken);
    expect(isBlacklistedBefore).toBe(false);

    // Добавляем в черный список с TTL 60 секунд
    await TokenBlacklistService.blacklistToken(sampleToken, 60);

    // Проверяем, что токен теперь находится в черном списке
    const isBlacklistedAfter =
      await TokenBlacklistService.isBlacklisted(sampleToken);
    expect(isBlacklistedAfter).toBe(true);
  });
});
