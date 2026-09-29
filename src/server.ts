import Fastify, {type FastifyRequest} from 'fastify';
import {JwtService, type JwtPayload} from './core/jwt.service.js';
import {verifyTokenHook} from './http/auth.hook.js';
import {RbacGuard} from './core/rbac.guard.js';
import {TokenBlacklistService} from './cache/token.blacklist.service.js';
import {RoleCacheService} from './cache/role.cache.service.js';

const server = Fastify({
  logger: true,
});

// Убрали неиспользуемые параметры request и reply
server.post('/api/login', async () => {
  const payload = {
    userId: '123',
    username: 'ivan_researcher',
    name: 'Иван Иванов',
    roles: ['Researcher'],
    permissions: ['read:articles'],
  };

  const token = JwtService.generateToken(payload);
  return {accessToken: token};
});

server.get(
  '/api/articles',
  {preHandler: [verifyTokenHook()]},
  async (request, reply) => {
    // Избавляемся от any, расширяя стандартный FastifyRequest нашим типом
    const user = (request as FastifyRequest & {user: JwtPayload}).user;

    if (!(await RbacGuard.hasPermission(user, 'read:articles'))) {
      return reply
        .status(403)
        .send({error: 'Недостаточно прав для чтения статей'});
    }

    return {
      message: `Добро пожаловать, ${user.name}! Вот список научных статей...`,
      data: [{id: 1, title: 'Анализ производительности Fastify'}],
    };
  },
);

server.post(
  '/api/logout',
  {preHandler: [verifyTokenHook()]},
  // Убрали неиспользуемый reply
  async (request) => {
    const authHeader = request.headers.authorization;
    const token = authHeader!.split(' ')[1]!;

    // Добавляем поле exp к типу, так как оно нужно для вычисления времени жизни
    const user = (
      request as FastifyRequest & {user: JwtPayload & {exp: number}}
    ).user;

    const currentSeconds = Math.floor(Date.now() / 1000);
    const expiresInSeconds = user.exp - currentSeconds;

    await TokenBlacklistService.blacklistToken(token, expiresInSeconds);

    return {message: 'Сеанс успешно завершен. Токен заблокирован.'};
  },
);

const start = async () => {
  try {
    await RoleCacheService.syncRolesToCache();

    await server.listen({port: 3000, host: '0.0.0.0'});
    console.log('Научный портал запущен на http://localhost:3000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
