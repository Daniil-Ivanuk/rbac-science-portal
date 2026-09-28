import {jest, describe, beforeEach, afterAll, it, expect} from '@jest/globals';

// 1. Подменяем ioredis на мок до импорта любых сервисов
jest.unstable_mockModule('ioredis', async () => {
  const mock = await import('ioredis-mock');
  const mockRedis = mock.default || mock;

  return {
    default: mockRedis,
    Redis: mockRedis, // Добавили именованный экспорт, который требует ваш код
  };
});

// 2. Динамически загружаем сервисы (пути должны указывать на ваши реальные файлы)
const {TokenBlacklistService} =
  await import('../src/cache/token.blacklist.service');
const {redisClient} = await import('../src/cache/redis.client');

describe('Redis Cache and Blacklist Service Tests', () => {
  beforeEach(async () => {
    // Очищаем кэш перед каждым тестом
    await redisClient.flushall();
  });

  afterAll(async () => {
    // Закрываем соединение после всех проверок
    await redisClient.quit();
  });

  it('должен добавлять токен в черный список и корректно определять его статус', async () => {
    const token = 'test-token-123';
    await TokenBlacklistService.blacklistToken(token, 3600);
    const isBlacklisted = await TokenBlacklistService.isBlacklisted(token);

    expect(isBlacklisted).toBe(true);
  });

  it('не должен считать токен заблокированным, если его нет в Redis', async () => {
    const isBlacklisted =
      await TokenBlacklistService.isBlacklisted('valid-token');
    expect(isBlacklisted).toBe(false);
  });

  it('должен корректно сохранять и получать права роли из кэша Redis', async () => {
    const role = 'admin';
    const permissions = JSON.stringify(['read', 'write', 'delete']);

    await redisClient.set(`role:${role}`, permissions);
    const cached = await redisClient.get(`role:${role}`);

    expect(cached).toBe(permissions);
    expect(JSON.parse(cached as string)).toContain('write');
  });

  it('должен корректно инвалидировать (сбрасывать) кэш роли', async () => {
    const role = 'manager';
    await redisClient.set(`role:${role}`, JSON.stringify(['read', 'update']));

    await redisClient.del(`role:${role}`);
    const cached = await redisClient.get(`role:${role}`);

    expect(cached).toBeNull();
  });
});
