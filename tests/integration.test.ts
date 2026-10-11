import {describe, it, beforeAll, afterAll, expect, jest} from '@jest/globals';
import Fastify, {type FastifyInstance} from 'fastify';
import {prisma} from '../src/db/prisma.client.js';
import {redisClient} from '../src/cache/redis.client.js';
import {
  initRbacModule,
  JwtService,
  RoleService,
  TokenBlacklistService,
  verifyTokenHook,
} from '../src/index.js';

jest.setTimeout(30000);

describe('RBAC Integration Tests (Module -> Redis -> SQL Server)', () => {
  let app: FastifyInstance;
  let testUserId: string | undefined;
  let testRoleId: number | undefined;
  let validToken: string;

  const testRoleName = `IntegrationRole_${Date.now()}`;
  const testUsername = `IntegrationUser_${Date.now()}`;

  beforeAll(async () => {
    // 1. Передаем конфигурацию в инициализатор модуля
    await initRbacModule({
      jwtSecret: process.env.JWT_SECRET || 'test-secret',
      redisClient: redisClient,
      dbClient: prisma,
    });

    const role = await RoleService.createRole(testRoleName, 'Тестовая роль');
    testRoleId = role.id;

    const user = await prisma.user.create({
      data: {username: testUsername},
    });
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
        return {success: true, message: 'Доступ разрешен'};
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

    await app.close();
    await prisma.$disconnect();
    redisClient.quit();
  });

  it('должен пропускать запрос с валидным токеном и правильной ролью', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: `Bearer ${validToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      message: 'Доступ разрешен',
    });
  });

  it('должен блокировать запрос после отзыва (blacklist) токена в Redis', async () => {
    await TokenBlacklistService.blacklistToken(validToken, 3600);

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: `Bearer ${validToken}`,
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
