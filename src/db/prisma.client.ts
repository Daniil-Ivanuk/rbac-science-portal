import {PrismaClient} from '@prisma/client';

// Экспортируем синглтон клиента Prisma
export const prisma = new PrismaClient();
