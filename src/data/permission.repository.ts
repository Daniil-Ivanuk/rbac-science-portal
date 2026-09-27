import {poolPromise} from './database.js';

export interface Permission {
  id?: number;
  name: string;
  resource: string;
}

export class PermissionRepository {
  // CREATE: Создание нового правила
  public async create(permission: Permission): Promise<number> {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('Name', permission.name)
      .input('Resource', permission.resource).query(`
        INSERT INTO Permissions (Name, Resource) 
        OUTPUT INSERTED.Id 
        VALUES (@Name, @Resource)
      `);
    return result.recordset[0].Id;
  }

  // READ: Получение прав, назначенных конкретной роли
  public async getPermissionsByRoleId(roleId: number): Promise<Permission[]> {
    const pool = await poolPromise;
    const result = await pool.request().input('RoleId', roleId).query(`
        SELECT p.Id, p.Name, p.Resource 
        FROM Permissions p
        INNER JOIN RolePermissions rp ON p.Id = rp.PermissionId
        WHERE rp.RoleId = @RoleId
      `);

    return result.recordset.map((row) => ({
      id: row.Id,
      name: row.Name,
      resource: row.Resource,
    }));
  }

  // ASSIGN: Привязка права к роли (запись в сводную таблицу)
  public async assignToRole(
    roleId: number,
    permissionId: number,
  ): Promise<void> {
    const pool = await poolPromise;
    await pool
      .request()
      .input('RoleId', roleId)
      .input('PermissionId', permissionId).query(`
        IF NOT EXISTS (
          SELECT 1 FROM RolePermissions 
          WHERE RoleId = @RoleId AND PermissionId = @PermissionId
        )
        BEGIN
          INSERT INTO RolePermissions (RoleId, PermissionId) 
          VALUES (@RoleId, @PermissionId)
        END
      `);
  }

  // REVOKE: Отвязка права от роли
  public async revokeFromRole(
    roleId: number,
    permissionId: number,
  ): Promise<void> {
    const pool = await poolPromise;
    await pool
      .request()
      .input('RoleId', roleId)
      .input('PermissionId', permissionId).query(`
        DELETE FROM RolePermissions 
        WHERE RoleId = @RoleId AND PermissionId = @PermissionId
      `);
  }
}
