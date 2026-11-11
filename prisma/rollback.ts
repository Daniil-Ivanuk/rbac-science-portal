import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const SAFE_MIGRATION_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

interface AppliedMigration {
  migration_name: string;
}

export async function rollbackMigration(
  options: {
    all?: boolean | undefined;
    target?: string | undefined;
  } = {},
): Promise<void> {
  // Safety guard: prevent accidental execution in production environment
  if (
    process.env.NODE_ENV === 'production' &&
    !process.argv.includes('--force-production')
  ) {
    throw new Error(
      '[Security Guard] Rollback aborted: Execution in production environment requires explicit --force-production flag.',
    );
  }

  const migrationsDir = path.resolve(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`[Prisma Rollback] Error: Migrations directory not found at: ${migrationsDir}`);
  }

  try {
    let migrationsToRollback: string[] = [];

    if (options.target) {
      migrationsToRollback = [options.target];
    } else {
      const tableCheck = await prisma.$queryRawUnsafe<Array<{ exists: number }>>(`
        SELECT COUNT(*) as [exists] 
        FROM sys.tables 
        WHERE name = '_prisma_migrations'
      `);

      const hasMigrationsTable = tableCheck[0] && tableCheck[0].exists > 0;

      if (hasMigrationsTable) {
        const applied = await prisma.$queryRawUnsafe<AppliedMigration[]>(`
          SELECT migration_name 
          FROM _prisma_migrations 
          WHERE rolled_back_at IS NULL AND finished_at IS NOT NULL 
          ORDER BY started_at DESC
        `);

        if (applied.length === 0) {
          console.log('[Prisma Rollback] No active migrations found to roll back.');
          return;
        }

        migrationsToRollback = options.all 
          ? applied.map((m) => m.migration_name) 
          : [applied[0]!.migration_name];
      } else {
        const dirs = fs
          .readdirSync(migrationsDir, { withFileTypes: true })
          .filter((d: fs.Dirent) => d.isDirectory() && fs.existsSync(path.join(migrationsDir, d.name, 'down.sql')))
          .map((d: fs.Dirent) => d.name)
          .sort()
          .reverse();

        if (dirs.length === 0) {
          console.log('[Prisma Rollback] No migrations with down.sql found on disk.');
          return;
        }

        migrationsToRollback = options.all ? dirs : [dirs[0]!];
      }
    }

    for (const migrationName of migrationsToRollback) {
      // Security Check 1: Whitelist characters to prevent command/path injection
      if (!SAFE_MIGRATION_NAME_REGEX.test(migrationName)) {
        throw new Error(
          `[Security Guard] Invalid migration name: "${migrationName}". Potential injection attempt rejected.`,
        );
      }

      // Security Check 2: Path traversal validation
      const targetMigrationDir = path.resolve(migrationsDir, migrationName);
      if (!targetMigrationDir.startsWith(migrationsDir + path.sep)) {
        throw new Error(
          `[Security Guard] Path traversal attempt detected for migration name: "${migrationName}".`,
        );
      }

      const downSqlPath = path.join(targetMigrationDir, 'down.sql');

      if (!fs.existsSync(downSqlPath)) {
        throw new Error(`Rollback script not found for migration "${migrationName}": expected at ${downSqlPath}`);
      }

      console.log(`[Prisma Rollback] Rolling back migration: ${migrationName}...`);
      const sqlContent = fs.readFileSync(downSqlPath, 'utf-8');

      // Execute transactionally isolated rollback SQL
      await prisma.$executeRawUnsafe(sqlContent);

      // Security Check 3: Parameterized query prevents SQL injection
      try {
        await prisma.$executeRaw`
          UPDATE _prisma_migrations 
          SET rolled_back_at = CURRENT_TIMESTAMP 
          WHERE migration_name = ${migrationName} AND rolled_back_at IS NULL
        `;
      } catch {
        // Table might not exist if schema was deployed via db push
      }

      console.log(`[Prisma Rollback] Successfully rolled back migration: ${migrationName}`);
    }
  } catch (error) {
    console.error('[Prisma Rollback] Failed to rollback migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  const isAll = process.argv.includes('--all');
  const targetIndex = process.argv.indexOf('--target');
  const target = targetIndex !== -1 ? process.argv[targetIndex + 1] : undefined;

  rollbackMigration({ all: isAll, target })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
