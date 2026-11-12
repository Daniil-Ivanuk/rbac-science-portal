import {describe, it, beforeAll, afterAll, expect, jest} from '@jest/globals';
import Fastify, {type FastifyInstance} from 'fastify';
import {prisma} from '../src/db/prisma.client.js';
import {redisClient} from '../src/cache/redis.client.js';
import {
  initRbacModule,
  JwtService,
  RoleService,
  UserRepository,
  TokenBlacklistService,
  verifyTokenHook,
} from '../src/index.js';

jest.setTimeout(30000);

describe('RBAC Integration Tests (Module -> Redis -> SQL Server)', () => {
  let app: FastifyInstance | undefined;
  let testUserId: string | undefined;
  let testRoleId: number | undefined;
  let validToken: string;

  const testRoleName = `IntegrationRole_${Date.now()}`;
  const testUsername = `IntegrationUser_${Date.now()}`;

  beforeAll(async () => {
    await initRbacModule({
      jwtSecret: process.env.JWT_SECRET || 'test-secret',
      redisClient: redisClient,
      dbClient: prisma,
    });

    const role = await RoleService.createRole(testRoleName, 'Test role');
    testRoleId = role.id;

    const userRepo = new UserRepository(prisma);
    const user = await userRepo.create({username: testUsername});
    testUserId = user.id;

    await RoleService.assignRoleToUser(testUserId, testRoleId);

    app = Fastify();

    app.get(
      '/protected',
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        preHandler: [verifyTokenHook([testRoleName]) as any],
      },
      async () => {
        return {success: true, message: 'Access granted'};
      },
    );

    await app.ready();

    validToken = JwtService.generateToken({
      userId: testUserId,
      username: testUsername,
      name: testUsername,
      roles: [testRoleName],
      permissions: [],
    });
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.userRole.deleteMany({where: {userId: testUserId}});
      await prisma.user.delete({where: {id: testUserId}});
    }

    if (testRoleId) {
      await prisma.role.delete({where: {id: testRoleId}});
    }

    if (app) {
      await app.close();
    }
    await prisma.$disconnect();
    redisClient.quit();
  });

  it('should allow a request with a valid token and the correct role', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: `Bearer ${validToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      message: 'Access granted',
    });
  });

  it('should block a request after revoking (blacklisting) the token in Redis', async () => {
    await TokenBlacklistService.blacklistToken(validToken, 3600);

    const response = await app!.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: `Bearer ${validToken}`,
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
