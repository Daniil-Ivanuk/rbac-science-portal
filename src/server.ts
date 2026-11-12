import 'dotenv/config';
import Fastify, {type FastifyRequest} from 'fastify';
import {prisma} from './db/prisma.client.js';
import {redisClient} from './cache/redis.client.js';
import {initRbacModule} from './index.js';
import {type JwtPayload} from './core/jwt.service.js';
import {verifyTokenHook} from './http/auth.hook.js';
import {RbacGuard} from './core/rbac.guard.js';
import {AuthService} from './core/auth.service.js';
import {RoleService} from './core/role.service.js';
import {ArticleService} from './core/article.service.js';
import {
  AccessDeniedError,
  EntityNotFoundError,
  RbacError,
  ValidationError,
} from './core/errors.js';

type AuthenticatedRequest = FastifyRequest & {user: JwtPayload};

const server = Fastify({
  logger: true,
});

const authService = new AuthService(prisma);
const roleService = new RoleService(prisma);
const articleService = new ArticleService(prisma);

server.addContentTypeParser(
  'application/x-www-form-urlencoded',
  {parseAs: 'string'},
  (_request, body, done) => {
    try {
      const parsed = Object.fromEntries(new URLSearchParams(body as string));
      done(null, parsed);
    } catch (err) {
      done(err as Error);
    }
  },
);

server.setErrorHandler((error, _request, reply) => {
  if (error instanceof RbacError) {
    return reply.status(error.statusCode).send({
      error: error.message,
      statusCode: error.statusCode,
    });
  }

  const fastifyStatusCode = (error as {statusCode?: number}).statusCode;
  if (
    fastifyStatusCode &&
    fastifyStatusCode >= 400 &&
    fastifyStatusCode < 500
  ) {
    return reply.status(fastifyStatusCode).send({
      error: error instanceof Error ? error.message : 'Bad request',
      statusCode: fastifyStatusCode,
    });
  }

  server.log.error(error);
  return reply.status(500).send({
    error: 'Internal server error',
    statusCode: 500,
  });
});

server.get('/', async () => {
  return {
    service: 'RBAC Science Portal API',
    version: '1.1.0',
    status: 'running',
  };
});

server.get('/health', async () => {
  let dbStatus: string;
  let redisStatus = 'degraded';

  try {
    await roleService.getAllRoles();
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }

  try {
    const pong = await redisClient.ping();
    if (pong === 'PONG') {
      redisStatus = 'connected';
    }
  } catch {
    redisStatus = 'degraded (DB fallback active)';
  }

  return {
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    database: dbStatus,
    redis: redisStatus,
  };
});

server.post('/api/auth/register', async (request, reply) => {
  const body = request.body as {
    username?: string;
    password?: string;
    fullName?: string;
  } | null;

  if (!body || !body.username || !body.password) {
    throw new ValidationError('Fields "username" and "password" are required');
  }

  const user = await authService.register({
    username: body.username,
    password: body.password,
    fullName: body.fullName,
  });

  return reply.status(201).send({user});
});

const handleLogin = async (request: FastifyRequest) => {
  const body = request.body as {
    username?: string;
    password?: string;
  } | null;

  if (!body || !body.username || !body.password) {
    throw new ValidationError('Fields "username" and "password" are required');
  }

  return authService.login(body.username, body.password);
};

server.post('/api/auth/login', handleLogin);
server.post('/api/login', handleLogin);

const handleLogout = async (request: FastifyRequest) => {
  const authHeader = request.headers.authorization;
  const token = authHeader!.split(' ')[1]!;
  const user = (request as AuthenticatedRequest).user as JwtPayload & {
    exp?: number;
  };

  await authService.logout(token, user.exp);
  return {message: 'Session ended successfully. Token has been blacklisted.'};
};

server.post(
  '/api/auth/logout',
  {preHandler: [verifyTokenHook()]},
  handleLogout,
);
server.post('/api/logout', {preHandler: [verifyTokenHook()]}, handleLogout);

server.get(
  '/api/auth/me',
  {preHandler: [verifyTokenHook()]},
  async (request) => {
    const user = (request as AuthenticatedRequest).user;
    return authService.getCurrentUser(user.userId);
  },
);

server.get(
  '/api/users',
  {preHandler: [verifyTokenHook(['Admin'])]},
  async () => {
    const users = await roleService.getAllUsers();
    return {users};
  },
);

server.get(
  '/api/users/:id/access',
  {preHandler: [verifyTokenHook(['Admin'])]},
  async (request) => {
    const {id} = request.params as {id: string};
    const access = await roleService.getUserAccessConfig(id);
    if (!access) {
      throw new EntityNotFoundError(`User with ID ${id} not found`);
    }
    return access;
  },
);

server.post(
  '/api/users/:id/roles',
  {preHandler: [verifyTokenHook(['Admin'])]},
  async (request) => {
    const {id} = request.params as {id: string};
    const body = request.body as {roleId?: number; roleName?: string} | null;

    let targetRoleId = body?.roleId;
    if (!targetRoleId && body?.roleName) {
      const role = await roleService.getRoleByName(body.roleName);
      if (!role) {
        throw new EntityNotFoundError(`Role "${body.roleName}" not found`);
      }
      targetRoleId = role.id;
    }

    if (!targetRoleId || !Number.isInteger(targetRoleId)) {
      throw new ValidationError('Provide valid "roleId" or "roleName"');
    }

    await roleService.assignRoleToUser(id, targetRoleId);
    return {message: 'Role assigned to user successfully'};
  },
);

server.delete(
  '/api/users/:id/roles/:roleId',
  {preHandler: [verifyTokenHook(['Admin'])]},
  async (request) => {
    const {id, roleId} = request.params as {id: string; roleId: string};
    const parsedRoleId = Number(roleId);
    if (!Number.isInteger(parsedRoleId) || parsedRoleId <= 0) {
      throw new ValidationError('Invalid roleId parameter');
    }

    await roleService.revokeRoleFromUser(id, parsedRoleId);
    return {message: 'Role revoked from user successfully'};
  },
);

server.patch(
  '/api/users/:id/status',
  {preHandler: [verifyTokenHook(['Admin'])]},
  async (request) => {
    const {id} = request.params as {id: string};
    const body = request.body as {isActive?: boolean} | null;
    if (typeof body?.isActive !== 'boolean') {
      throw new ValidationError('Field "isActive" (boolean) is required');
    }

    const user = await roleService.setUserActiveStatus(id, body.isActive);
    return {user};
  },
);

server.get('/api/roles', {preHandler: [verifyTokenHook()]}, async () => {
  const roles = await roleService.getAllRoles();
  return {roles};
});

server.post(
  '/api/roles',
  {preHandler: [verifyTokenHook(['Admin'])]},
  async (request, reply) => {
    const body = request.body as {name?: string; description?: string} | null;
    if (!body?.name?.trim()) {
      throw new ValidationError('Role "name" is required');
    }

    const role = await roleService.createRole(
      body.name.trim(),
      body.description ?? null,
    );
    return reply.status(201).send({role});
  },
);

server.delete(
  '/api/roles/:id',
  {preHandler: [verifyTokenHook(['Admin'])]},
  async (request) => {
    const {id} = request.params as {id: string};
    const roleId = Number(id);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      throw new ValidationError('Invalid role ID');
    }

    await roleService.deleteRole(roleId);
    return {message: 'Role deleted successfully'};
  },
);

server.get(
  '/api/permissions',
  {preHandler: [verifyTokenHook(['Admin'])]},
  async () => {
    const permissions = await roleService.getAllPermissions();
    return {permissions};
  },
);

server.post(
  '/api/permissions',
  {preHandler: [verifyTokenHook(['Admin'])]},
  async (request, reply) => {
    const body = request.body as {name?: string; resource?: string} | null;
    if (!body?.name?.trim() || !body?.resource?.trim()) {
      throw new ValidationError('Fields "name" and "resource" are required');
    }

    const permission = await roleService.createPermission(
      body.name.trim(),
      body.resource.trim(),
    );
    return reply.status(201).send({permission});
  },
);

server.post(
  '/api/roles/:roleId/permissions',
  {preHandler: [verifyTokenHook(['Admin'])]},
  async (request) => {
    const {roleId} = request.params as {roleId: string};
    const parsedRoleId = Number(roleId);
    if (!Number.isInteger(parsedRoleId) || parsedRoleId <= 0) {
      throw new ValidationError('Invalid roleId parameter');
    }

    const body = request.body as {
      permissionId?: number;
      permissionName?: string;
    } | null;

    let targetPermissionId = body?.permissionId;
    if (!targetPermissionId && body?.permissionName) {
      const perm = await roleService.getPermissionByName(body.permissionName);
      if (!perm) {
        throw new EntityNotFoundError(
          `Permission "${body.permissionName}" not found`,
        );
      }
      targetPermissionId = perm.id;
    }

    if (!targetPermissionId || !Number.isInteger(targetPermissionId)) {
      throw new ValidationError(
        'Provide valid "permissionId" or "permissionName"',
      );
    }

    await roleService.assignPermissionToRole(parsedRoleId, targetPermissionId);
    return {message: 'Permission assigned to role and cache invalidated'};
  },
);

server.delete(
  '/api/roles/:roleId/permissions/:permissionId',
  {preHandler: [verifyTokenHook(['Admin'])]},
  async (request) => {
    const {roleId, permissionId} = request.params as {
      roleId: string;
      permissionId: string;
    };
    const parsedRoleId = Number(roleId);
    const parsedPermissionId = Number(permissionId);
    if (
      !Number.isInteger(parsedRoleId) ||
      parsedRoleId <= 0 ||
      !Number.isInteger(parsedPermissionId) ||
      parsedPermissionId <= 0
    ) {
      throw new ValidationError('Invalid roleId or permissionId parameter');
    }

    await roleService.revokePermissionFromRole(
      parsedRoleId,
      parsedPermissionId,
    );
    return {message: 'Permission revoked from role and cache invalidated'};
  },
);

server.get(
  '/api/articles',
  {preHandler: [verifyTokenHook()]},
  async (request) => {
    const user = (request as AuthenticatedRequest).user;

    if (!(await RbacGuard.hasPermission(user, 'read:articles'))) {
      throw new AccessDeniedError('Insufficient permissions to read articles');
    }

    const articles = await articleService.getAllArticles();
    return {
      requestedBy: user.username,
      count: articles.length,
      data: articles,
    };
  },
);

server.get(
  '/api/articles/:id',
  {preHandler: [verifyTokenHook()]},
  async (request) => {
    const user = (request as AuthenticatedRequest).user;
    if (!(await RbacGuard.hasPermission(user, 'read:articles'))) {
      throw new AccessDeniedError('Insufficient permissions to read articles');
    }

    const {id} = request.params as {id: string};
    const article = await articleService.getArticleById(Number(id));
    return {data: article};
  },
);

server.post(
  '/api/articles',
  {preHandler: [verifyTokenHook()]},
  async (request, reply) => {
    const user = (request as AuthenticatedRequest).user;
    if (!(await RbacGuard.hasPermission(user, 'write:articles'))) {
      throw new AccessDeniedError(
        'Insufficient permissions to publish articles',
      );
    }

    const body = request.body as {
      title?: string;
      content?: string;
      isPublished?: boolean;
    } | null;

    if (!body?.title || !body?.content) {
      throw new ValidationError('Fields "title" and "content" are required');
    }

    const article = await articleService.createArticle({
      title: body.title,
      content: body.content,
      authorId: user.userId,
      isPublished: body.isPublished,
    });

    return reply.status(201).send({data: article});
  },
);

server.patch(
  '/api/articles/:id',
  {preHandler: [verifyTokenHook()]},
  async (request) => {
    const user = (request as AuthenticatedRequest).user;
    if (!(await RbacGuard.hasPermission(user, 'write:articles'))) {
      throw new AccessDeniedError('Insufficient permissions to edit articles');
    }

    const {id} = request.params as {id: string};
    const body = request.body as {
      title?: string;
      content?: string;
      isPublished?: boolean;
    } | null;

    const article = await articleService.updateArticle(
      Number(id),
      {
        title: body?.title,
        content: body?.content,
        isPublished: body?.isPublished,
      },
      user.userId,
      RbacGuard.hasRole(user, ['Admin']),
    );

    return {data: article};
  },
);

server.delete(
  '/api/articles/:id',
  {preHandler: [verifyTokenHook()]},
  async (request) => {
    const user = (request as AuthenticatedRequest).user;
    if (!(await RbacGuard.hasPermission(user, 'write:articles'))) {
      throw new AccessDeniedError(
        'Insufficient permissions to delete articles',
      );
    }

    const {id} = request.params as {id: string};
    await articleService.deleteArticle(
      Number(id),
      user.userId,
      RbacGuard.hasRole(user, ['Admin']),
    );

    return {message: 'Article deleted successfully'};
  },
);

const shutdown = async () => {
  await server.close();
  await prisma.$disconnect();
  redisClient.quit();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const start = async () => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error(
        'Critical error: JWT_SECRET environment variable is not set',
      );
    }

    await initRbacModule({
      jwtSecret,
      redisClient,
      dbClient: prisma,
    });

    const port = Number(process.env.PORT || 3000);
    await server.listen({port, host: '0.0.0.0'});
    console.log(`Science portal is running at http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
