import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {hashPassword} from '../src/core/security.js';
import {
  ArticleRepository,
  PermissionRepository,
  RoleRepository,
  UserRepository,
} from '../src/repositories/index.js';

const prisma = new PrismaClient();
const userRepo = new UserRepository(prisma);
const roleRepo = new RoleRepository(prisma);
const permissionRepo = new PermissionRepository(prisma);
const articleRepo = new ArticleRepository(prisma);

async function ensurePermission(name: string, resource: string) {
  const existing = await permissionRepo.getByName(name);
  if (existing) {
    return existing;
  }
  return permissionRepo.create(name, resource);
}

async function ensureRole(name: string, description: string) {
  const existing = await roleRepo.getByName(name);
  if (existing) {
    return existing;
  }
  return roleRepo.create(name, description);
}

async function ensureUser(
  username: string,
  plainPassword: string,
  fullName: string,
  roleId: number,
) {
  let user = await userRepo.getByUsername(username);
  if (!user) {
    const passwordHash = await hashPassword(plainPassword);
    const created = await userRepo.create({
      username,
      passwordHash,
      fullName,
      isActive: true,
    });
    await userRepo.assignRole(created.id, roleId);
    return created;
  }
  return user;
}

async function main() {
  console.log('Starting database seeding...');

  const readArticles = await ensurePermission('read:articles', 'articles');
  const writeArticles = await ensurePermission('write:articles', 'articles');
  const manageRoles = await ensurePermission('manage:roles', 'roles');
  const manageUsers = await ensurePermission('manage:users', 'users');

  const adminRole = await ensureRole('Admin', 'System administrator');
  const researcherRole = await ensureRole(
    'Researcher',
    'Scientific researcher',
  );

  for (const perm of [
    readArticles,
    writeArticles,
    manageRoles,
    manageUsers,
  ]) {
    await permissionRepo.assignToRole(adminRole.id, perm.id);
  }

  await permissionRepo.assignToRole(researcherRole.id, readArticles.id);

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
  const researcherPassword =
    process.env.SEED_RESEARCHER_PASSWORD || 'Researcher123!';

  const adminUser = await ensureUser(
    'admin',
    adminPassword,
    'Portal Administrator',
    adminRole.id,
  );
  const researcherUser = await ensureUser(
    'ivan_researcher',
    researcherPassword,
    'Ivan Ivanov',
    researcherRole.id,
  );

  const existingArticles = await articleRepo.getAll();
  if (existingArticles.length === 0) {
    await articleRepo.create({
      title: 'Role-Based Access Control Architecture in Distributed Systems',
      content:
        'Detailed analysis of JWT-based RBAC authorization with Redis caching and SQL Server persistence fallback.',
      authorId: adminUser.id,
      isPublished: true,
    });

    await articleRepo.create({
      title: 'High-Throughput Caching Strategies for Academic Portals',
      content:
        'Evaluating cache-aside invalidation policies and graceful degradation under cache node failure.',
      authorId: researcherUser.id,
      isPublished: true,
    });
  }

  console.log(
    'Database successfully seeded with default roles, permissions, users, and articles!',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
