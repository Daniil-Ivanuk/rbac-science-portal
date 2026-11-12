import {jest, describe, beforeEach, afterAll, it, expect} from '@jest/globals';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

jest.unstable_mockModule('ioredis', async () => {
  const mock = await import('ioredis-mock');
  const mockRedis = mock.default || mock;

  return {
    default: mockRedis,
    Redis: mockRedis,
  };
});

const {TokenBlacklistService} =
  await import('../src/cache/token.blacklist.service.js');
const {RoleCacheService} = await import('../src/cache/role.cache.service.js');
const {redisClient} = await import('../src/cache/redis.client.js');
const {RbacContext} = await import('../src/index.js');

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

  it('should handle Redis failure gracefully when checking blacklist', async () => {
    const originalGet = redisClient.get.bind(redisClient);
    (redisClient as unknown as {get: unknown}).get = jest
      .fn<() => Promise<string | null>>()
      .mockRejectedValue(new Error('Connection lost'));

    const isBlacklisted =
      await TokenBlacklistService.isBlacklisted('some-token');
    expect(isBlacklisted).toBe(false);

    redisClient.get = originalGet;
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

  it('should fallback to database when role is not in Redis cache and then warm up cache', async () => {
    RbacContext.isInitialized = true;
    RbacContext.redis = redisClient as unknown as typeof RbacContext.redis;
    RbacContext.db = {
      role: {
        findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
          name: 'Editor',
          permissions: [
            {permission: {name: 'edit:content'}},
            {permission: {name: 'publish:content'}},
          ],
        }),
      },
    } as unknown as typeof RbacContext.db;

    const permissions = await RoleCacheService.getRolePermissions('Editor');
    expect(permissions).toEqual(['edit:content', 'publish:content']);

    const cachedInRedis = await redisClient.get('role:Editor');
    expect(JSON.parse(cachedInRedis as string)).toEqual([
      'edit:content',
      'publish:content',
    ]);
  });

  it('should fallback to database when Redis get operation fails completely', async () => {
    RbacContext.isInitialized = true;
    const failingRedis = {
      get: jest
        .fn<() => Promise<string | null>>()
        .mockRejectedValue(new Error('Redis connection refused')),
      set: jest
        .fn<() => Promise<string>>()
        .mockRejectedValue(new Error('Redis write failed')),
    };
    RbacContext.redis = failingRedis as unknown as typeof RbacContext.redis;
    RbacContext.db = {
      role: {
        findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
          name: 'Supervisor',
          permissions: [{permission: {name: 'view:reports'}}],
        }),
      },
    } as unknown as typeof RbacContext.db;

    const permissions = await RoleCacheService.getRolePermissions('Supervisor');
    expect(permissions).toEqual(['view:reports']);

    RbacContext.redis = redisClient as unknown as typeof RbacContext.redis;
  });
});
