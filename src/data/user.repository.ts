import {poolPromise} from './database.js';

export class UserRepository {
  public async getUserPermissions(userId: string): Promise<string[]> {
    const pool = await poolPromise;
    const result = await pool.request().input('UserId', userId).query(`
        SELECT PermissionName 
        FROM vw_UserEffectivePermissions 
        WHERE UserId = @UserId
      `);
    return result.recordset.map((row) => row.PermissionName);
  }

  public async assignRole(userId: string, roleName: string): Promise<void> {
    const pool = await poolPromise;
    await pool
      .request()
      .input('UserId', userId)
      .input('RoleName', roleName)
      .execute('sp_AssignRoleToUser');
  }
}
