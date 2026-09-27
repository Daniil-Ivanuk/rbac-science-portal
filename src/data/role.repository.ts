import {poolPromise} from './database.js';

export interface Role {
  id?: number;
  name: string;
  description?: string;
}

export class RoleRepository {
  public async createRole(role: Role): Promise<number> {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('Name', role.name)
      .input('Description', role.description).query(`
        INSERT INTO Roles (Name, Description) 
        OUTPUT INSERTED.Id 
        VALUES (@Name, @Description)
      `);

    return result.recordset[0].Id;
  }

  public async getRoleByName(name: string): Promise<Role | null> {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('Name', name)
      .query('SELECT Id, Name, Description FROM Roles WHERE Name = @Name');

    if (result.recordset.length === 0) {
      return null;
    }

    const row = result.recordset[0];
    return {
      id: row.Id,
      name: row.Name,
      description: row.Description,
    };
  }

  public async assignRoleToUser(
    userId: string,
    roleName: string,
  ): Promise<void> {
    const pool = await poolPromise;
    await pool
      .request()
      .input('UserId', userId)
      .input('RoleName', roleName)
      .execute('sp_AssignRoleToUser'); // Вызов хранимой процедуры
  }
}
