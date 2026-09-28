import {Redis} from 'ioredis';
import RedisMock from 'ioredis-mock';

const isTest =
  process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = Number(process.env.REDIS_PORT) || 6379;

// Используем тип Redis, так как ioredis-mock полностью совместим с его интерфейсом
export const redisClient: Redis = (isTest
  ? new RedisMock()
  : new Redis({
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: 3,
    })) as unknown as Redis;

if (!isTest) {
  redisClient.on('connect', () => {
    console.log('Connected to Redis successfully');
  });

  redisClient.on('error', (err: Error) => {
    console.error('Redis connection error:', err);
  });
}
