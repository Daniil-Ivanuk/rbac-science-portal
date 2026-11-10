import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

interface AppliedMigration {
  migration_name: string;
}

export async function rollbackMigration(options: { all?: boolean; target?: string } = {}): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.error(`[Prisma Rollback] Error: Migrations directory not found at: ${migrationsDir}`);
    process.exit(1);
  }

  try {
    let migrationsToRollback: string[] = [];

    if (options.target) {
      migrationsToRollback = [options.target];
    } else {
      // Check if _prisma_migrations table exists
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
        // Fallback: discover available migrations with down.sql from disk in reverse order
        const dirs = fs
          .readdirSync(migrationsDir, { withFileTypes: true })
          .filter((d) => d.isDirectory() && fs.existsSync(path.join(migrationsDir, d.name, 'down.sql')))
          .map((d) => d.name)
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
      const downSqlPath = path.join(migrationsDir, migrationName, 'down.sql');

      if (!fs.existsSync(downSqlPath)) {
        throw new Error(`Rollback script not found for migration "${migrationName}": expected at ${downSqlPath}`);
      }

      console.log(`[Prisma Rollback] Rolling back migration: ${migrationName}...`);
      const sqlContent = fs.readFileSync(downSqlPath, 'utf-8');

      // Execute rollback SQL in transaction
      await prisma.$executeRawUnsafe(sqlContent);

      // Update _prisma_migrations record if table exists
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE _prisma_migrations 
          SET rolled_back_at = CURRENT_TIMESTAMP 
          WHERE migration_name = '${migrationName}' AND rolled_back_at IS NULL
        `);
      } catch {
        // Table might not exist if schema was deployed via db push
      }

      console.log(`[Prisma Rollback] Successfully rolled back migration: ${migrationName}`);
    }
  } catch (error) {
    console.error('[Prisma Rollback] Failed to rollback migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// CLI entry point
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
