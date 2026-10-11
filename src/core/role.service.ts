import {prisma} from '../db/prisma.client.js';

export class RoleService {
  static async createRole(name: string, description?: string | null) {
    return prisma.role.create({
      data: {
        name,
        description: description ?? null,
      },
    });
  }

  static async getRoleByName(name: string) {
    return prisma.role.findUnique({where: {name}});
  }

  static async createPermission(name: string, resource: string) {
    return prisma.permission.create({
      data: {name, resource},
    });
  }

  static async getPermissionByName(name: string) {
    return prisma.permission.findUnique({where: {name}});
  }

  static async assignPermissionToRole(roleId: number, permissionId: number) {
    return prisma.rolePermission.create({
      data: {
        roleId,
        permissionId,
      },
    });
  }

  static async assignRoleToUser(userId: string, roleId: number) {
    return prisma.userRole.create({
      data: {
        userId,
        roleId,
      },
    });
  }

  static async getUserAccessConfig(userId: string) {
    const user = await prisma.user.findUnique({
      where: {id: userId},
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.name),
    );

    return {
      userId: user.id,
      username: user.username,
      roles: [...new Set(roles)],
      permissions: [...new Set(permissions)],
    };
  }
}
