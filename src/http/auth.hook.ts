import type {FastifyRequest, FastifyReply} from 'fastify';
import {JwtService} from '../core/jwt.service.js';
import {TokenBlacklistService} from '../cache/token.blacklist.service.js';

export const verifyTokenHook = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply
      .status(401)
      .send({error: 'Отсутствует или некорректен заголовок Authorization'});
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return reply.status(401).send({error: 'Токен не найден'});
  }

  // 1. Проверяем, не отозван ли токен (Redis)
  const isBlacklisted = await TokenBlacklistService.isBlacklisted(token);
  if (isBlacklisted) {
    return reply
      .status(401)
      .send({error: 'Сессия завершена (токен в черном списке)'});
  }

  try {
    // 2. Валидируем криптографическую подпись и срок действия
    const payload = JwtService.verifyToken(token);

    // 3. Сохраняем расшифрованные данные пользователя в объекте запроса для эндпоинтов
    // Используем type assertion, так как расширяем стандартный объект FastifyRequest
    (request as any).user = payload;
  } catch (_error) {
    return reply
      .status(401)
      .send({error: 'Недействительный или просроченный токен'});
  }
};
