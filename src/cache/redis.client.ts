import {Redis} from 'ioredis';
import RedisMock from 'ioredis-mock';

// Гарантированно определяем, запущены ли мы через Jest
const isTest =
  process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = Number(process.env.REDIS_PORT) || 6379;

// Экспортируем мок для тестов и реальный клиент для продакшена
export const redisClient: any = isTest
  ? new RedisMock()
  : new Redis({
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: 3,
    });

if (!isTest) {
  redisClient.on('connect', () => {
    console.log('Connected to Redis successfully');
  });

  redisClient.on('error', (err: any) => {
    console.error('Redis connection error:', err);
  });
}
