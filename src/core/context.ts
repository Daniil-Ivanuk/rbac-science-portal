import type {Redis} from 'ioredis';
import type {PrismaClient} from '@prisma/client';

export class RbacContext {
  static jwtSecret: string;
  static redis: Redis;
  static db: PrismaClient;
  static isInitialized: boolean = false;
}
