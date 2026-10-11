import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Начинаем заполнение базы данных (seeding)...');

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

  for (const perm of [readArticles, writeArticles]) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id },
      },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

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