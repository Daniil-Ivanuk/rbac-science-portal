import {jest, describe, beforeEach, afterAll, it, expect} from '@jest/globals';

jest.unstable_mockModule('ioredis', async () => {
  const mock = await import('ioredis-mock');
  const mockRedis = mock.default || mock;

  return {
    default: mockRedis,
    Redis: mockRedis,
  };
});

const {TokenBlacklistService} =
  await import('../src/cache/token.blacklist.service');
const {redisClient} = await import('../src/cache/redis.client');

describe('Redis Cache and Blacklist Service Tests', () => {
  beforeEach(async () => {
    await redisClient.flushall();
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  it('should add a token to the blacklist and correctly determine its status', async () => {
    const token = 'test-token-123';
    await TokenBlacklistService.blacklistToken(token, 3600);
    const isBlacklisted = await TokenBlacklistService.isBlacklisted(token);

    expect(isBlacklisted).toBe(true);
  });

  it('should not consider a token blacklisted if it is not in Redis', async () => {
    const isBlacklisted =
      await TokenBlacklistService.isBlacklisted('valid-token');
    expect(isBlacklisted).toBe(false);
  });

  it('should correctly store and retrieve role permissions from Redis cache', async () => {
    const role = 'admin';
    const permissions = JSON.stringify(['read', 'write', 'delete']);

    await redisClient.set(`role:${role}`, permissions);
    const cached = await redisClient.get(`role:${role}`);

    expect(cached).toBe(permissions);
    expect(JSON.parse(cached as string)).toContain('write');
  });

  it('should correctly invalidate (clear) role cache', async () => {
    const role = 'manager';
    await redisClient.set(`role:${role}`, JSON.stringify(['read', 'update']));

    await redisClient.del(`role:${role}`);
    const cached = await redisClient.get(`role:${role}`);

    expect(cached).toBeNull();
  });
});
