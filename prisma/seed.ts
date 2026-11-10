import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

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
    create: { name: 'Admin', description: 'System administrator' },
  });

  const researcherRole = await prisma.role.upsert({
    where: { name: 'Researcher' },
    update: {},
    create: { name: 'Researcher', description: 'Scientific researcher' },
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

  console.log('Database successfully seeded with default roles and permissions!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });