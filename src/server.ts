import Fastify from 'fastify';
import {JwtService} from './core/jwt.service.js';
import {verifyTokenHook} from './http/auth.hook.js';
import {RbacGuard} from './core/rbac.guard.js';
import {TokenBlacklistService} from './cache/token.blacklist.service.js';
import {RoleCacheService} from './cache/role.cache.service.js';

const server = Fastify({
  logger: true, // Включаем встроенное логирование Fastify
});

server.post('/api/login', async (_request, _reply) => {
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

// Защищенный эндпоинт
server.get(
  '/api/articles',
  {preHandler: [verifyTokenHook]},
  async (request, reply) => {
    const user = (request as any).user;

    // Вызываем статический метод напрямую
    if (!RbacGuard.hasPermission(user, 'read:articles')) {
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
  {preHandler: [verifyTokenHook]},
  async (request, _reply) => {
    const authHeader = request.headers.authorization;
    const token = authHeader!.split(' ')[1]!;

    // Достаем payload пользователя, который сохранил verifyTokenHook
    const user = (request as any).user;

    // Вычисляем, сколько секунд осталось до конца жизни токена
    const currentSeconds = Math.floor(Date.now() / 1000);
    const expiresInSeconds = user.exp - currentSeconds;

    // Передаем правильное имя метода и оба аргумента
    await TokenBlacklistService.blacklistToken(token, expiresInSeconds);

    return {message: 'Сеанс успешно завершен. Токен заблокирован.'};
  },
);

// Запуск сервера
const start = async () => {
  try {
    // 1. Выгружаем матрицу ролей из SQL Server в кэш Redis при старте
    await RoleCacheService.syncRolesToCache();

    // 2. Подключаемся к порту 3000
    await server.listen({port: 3000, host: '0.0.0.0'});
    console.log('Научный портал запущен на http://localhost:3000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
