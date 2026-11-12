import type {Permission, PrismaClient} from '@prisma/client';

export interface PermissionRecord {
  id: number;
  name: string;
  resource: string;
}

export class PermissionRepository {
  constructor(private readonly db: PrismaClient) {}

  private static _toRead(permission: Permission): PermissionRecord {
    return {
      id: permission.id,
      name: permission.name,
      resource: permission.resource,
    };
  }

  public async create(
    name: string,
    resource: string,
  ): Promise<PermissionRecord> {
    const permission = await this.db.permission.create({
      data: {name, resource},
    });
    return PermissionRepository._toRead(permission);
  }

  public async getById(id: number): Promise<PermissionRecord | null> {
    const permission = await this.db.permission.findUnique({where: {id}});
    return permission ? PermissionRepository._toRead(permission) : null;
  }

  public async getByName(name: string): Promise<PermissionRecord | null> {
    const permission = await this.db.permission.findUnique({where: {name}});
    return permission ? PermissionRepository._toRead(permission) : null;
  }

  public async getAll(): Promise<PermissionRecord[]> {
    const permissions = await this.db.permission.findMany({
      orderBy: {id: 'asc'},
    });
    return permissions.map((p) => PermissionRepository._toRead(p));
  }

  public async getByRoleId(roleId: number): Promise<PermissionRecord[]> {
    const rows = await this.db.rolePermission.findMany({
      where: {roleId},
      include: {permission: true},
    });
    return rows.map((row) => PermissionRepository._toRead(row.permission));
  }

  public async assignToRole(
    roleId: number,
    permissionId: number,
  ): Promise<void> {
    await this.db.rolePermission.upsert({
      where: {
        roleId_permissionId: {roleId, permissionId},
      },
      update: {},
      create: {
        roleId,
        permissionId,
      },
    });
  }

  public async revokeFromRole(
    roleId: number,
    permissionId: number,
  ): Promise<void> {
    await this.db.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId,
      },
    });
  }
}
