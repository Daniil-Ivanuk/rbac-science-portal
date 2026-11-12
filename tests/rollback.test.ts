import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {describe, it, expect} from '@jest/globals';
import {rollbackMigration} from '../prisma/rollback.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Prisma Rollback Mechanism Tests', () => {
  const migrationsDir = path.resolve(__dirname, '../prisma/migrations');

  it('should export rollbackMigration function', () => {
    expect(rollbackMigration).toBeDefined();
    expect(typeof rollbackMigration).toBe('function');
  });

  it('should have a corresponding down.sql file for each migration directory', () => {
    const migrationDirs = fs
      .readdirSync(migrationsDir, {withFileTypes: true})
      .filter((d: fs.Dirent) => d.isDirectory())
      .map((d: fs.Dirent) => d.name);

    expect(migrationDirs.length).toBeGreaterThan(0);

    for (const dirName of migrationDirs) {
      const downSqlPath = path.join(migrationsDir, dirName, 'down.sql');
      expect(fs.existsSync(downSqlPath)).toBe(true);

      const content = fs.readFileSync(downSqlPath, 'utf-8');
      expect(content).toContain('DROP TABLE');
    }
  });

  it('should drop tables in reverse dependency order in down.sql', () => {
    const downSqlPath = path.join(
      migrationsDir,
      '20260929142518_init_rbac_schema',
      'down.sql',
    );
    const content = fs.readFileSync(downSqlPath, 'utf-8');

    const rolePermissionsIndex = content.indexOf('[dbo].[RolePermissions]');
    const userRolesIndex = content.indexOf('[dbo].[UserRoles]');
    const permissionsIndex = content.indexOf('[dbo].[Permissions]');
    const rolesIndex = content.indexOf('[dbo].[Roles]');
    const usersIndex = content.indexOf('[dbo].[Users]');

    expect(rolePermissionsIndex).toBeLessThan(rolesIndex);
    expect(rolePermissionsIndex).toBeLessThan(permissionsIndex);
    expect(userRolesIndex).toBeLessThan(usersIndex);
    expect(userRolesIndex).toBeLessThan(rolesIndex);
  });

  it('should reject malicious migration names with path traversal or injection characters', async () => {
    await expect(
      rollbackMigration({target: '../../malicious-path'}),
    ).rejects.toThrow(/\[Security Guard\]/);

    await expect(
      rollbackMigration({target: "test'; DROP TABLE Users; --"}),
    ).rejects.toThrow(/\[Security Guard\]/);
  });
});
