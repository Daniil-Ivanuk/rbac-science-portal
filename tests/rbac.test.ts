import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
} from '@jest/globals';
import {JwtService, type JwtPayload} from '../src/core/jwt.service.js';
import {RbacGuard} from '../src/core/rbac.guard.js';
import {redisClient} from '../src/cache/redis.client.js';
import {RbacContext} from '../src/index.js';

describe('RBAC and JWT Core Tests', () => {
  const mockUser: JwtPayload = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    username: 'researcher_ivan',
    name: 'Ivan Researcher',
    roles: ['Researcher'],
    permissions: ['read:articles', 'write:articles'],
  };

  beforeAll(() => {
    RbacContext.isInitialized = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RbacContext.redis = redisClient as any;

    if (!process.env.JWT_SECRET) {
      throw new Error(
        '[Test Setup] Critical error: JWT_SECRET is not set in the environment!',
      );
    }

    RbacContext.jwtSecret = process.env.JWT_SECRET;
  });

  afterAll(() => {
    redisClient.quit();
  });

  beforeEach(async () => {
    await RbacContext.redis.set(
      'role:Researcher',
      JSON.stringify(['read:articles', 'write:articles']),
    );
  });

  it('should successfully generate and verify a JWT token', () => {
    const token = JwtService.generateToken(mockUser);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);

    const decoded = JwtService.verifyToken(token);
    expect(decoded.username).toBe(mockUser.username);
    expect(decoded.name).toBe(mockUser.name);
    expect(decoded.roles).toEqual(mockUser.roles);
    expect(decoded.permissions).toEqual(mockUser.permissions);
  });

  it('should throw an error when validating an invalid token', () => {
    expect(() => {
      JwtService.verifyToken('invalid.token.string');
    }).toThrow('Invalid or expired JWT token');
  });

  it('should correctly check access permissions (RbacGuard)', async () => {
    await expect(
      RbacGuard.hasPermission(mockUser, 'read:articles'),
    ).resolves.toBe(true);

    await expect(
      RbacGuard.hasPermission(mockUser, 'delete:users'),
    ).resolves.toBe(false);

    expect(RbacGuard.hasRole(mockUser, ['Admin', 'Researcher'])).toBe(true);
    expect(RbacGuard.hasRole(mockUser, ['Admin'])).toBe(false);
  });
});
