import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Начинаем заполнение базы данных (seeding)...');

  // 1. Создаем базовые права (используем upsert, чтобы не создавать дубликаты при повторном запуске)
  const readArticles = await prisma.permission.upsert({
    where: { name: 'read:articles' },
    update: {},
    create: { name: 'read:articles', resource: 'articles' },
  });

  const writeArticles = await prisma.permission.upsert({
    where: { name: 'write:articles' },
    update: {},
    create: { name: 'write:articles', resource: 'articles' },
  });

  // 2. Создаем роли
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin', description: 'Администратор системы' },
  });

  const researcherRole = await prisma.role.upsert({
    where: { name: 'Researcher' },
    update: {},
    create: { name: 'Researcher', description: 'Научный сотрудник' },
  });

  // 3. Связываем роли и права
  // Администратор получает все права
  for (const perm of [readArticles, writeArticles]) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id },
      },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  // Научный сотрудник получает только право на чтение
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: { roleId: researcherRole.id, permissionId: readArticles.id },
    },
    update: {},
    create: { roleId: researcherRole.id, permissionId: readArticles.id },
  });

  console.log('База данных успешно заполнена базовыми ролями и правами!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });