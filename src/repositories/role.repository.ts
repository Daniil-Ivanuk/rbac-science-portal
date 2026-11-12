import type {PrismaClient, Role} from '@prisma/client';

export interface RoleRecord {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
}

export interface RoleWithPermissions extends RoleRecord {
  permissions: string[];
}

export class RoleRepository {
  constructor(private readonly db: PrismaClient) {}

  private static _toRead(role: Role): RoleRecord {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
    };
  }

  public async create(
    name: string,
    description?: string | null,
  ): Promise<RoleRecord> {
    const role = await this.db.role.create({
      data: {
        name,
        description: description ?? null,
      },
    });
    return RoleRepository._toRead(role);
  }

  public async getById(id: number): Promise<RoleRecord | null> {
    const role = await this.db.role.findUnique({where: {id}});
    return role ? RoleRepository._toRead(role) : null;
  }

  public async getByName(name: string): Promise<RoleRecord | null> {
    const role = await this.db.role.findUnique({where: {name}});
    return role ? RoleRepository._toRead(role) : null;
  }

  public async getAllWithPermissions(): Promise<RoleWithPermissions[]> {
    const roles = await this.db.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {id: 'asc'},
    });

    return roles.map((role) => ({
      ...RoleRepository._toRead(role),
      permissions: role.permissions.map(
        (rp: {permission: {name: string}}) => rp.permission.name,
      ),
    }));
  }

  public async getPermissionsByRoleName(
    roleName: string,
  ): Promise<string[] | null> {
    const role = await this.db.role.findUnique({
      where: {name: roleName},
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      return null;
    }

    return role.permissions.map(
      (rp: {permission: {name: string}}) => rp.permission.name,
    );
  }

  public async deleteById(id: number): Promise<void> {
    await this.db.role.delete({where: {id}});
  }
}
