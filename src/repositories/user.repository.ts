import type {PrismaClient, User} from '@prisma/client';

export interface UserRecord {
  id: string;
  username: string;
  fullName: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface UserStoreRecord extends UserRecord {
  passwordHash: string | null;
}

export interface CreateUserInput {
  username: string;
  passwordHash?: string | null | undefined;
  fullName?: string | null | undefined;
  isActive?: boolean | undefined;
}

export interface UserAccessConfig {
  userId: string;
  username: string;
  fullName: string | null;
  isActive: boolean;
  roles: string[];
  permissions: string[];
}

export class UserRepository {
  constructor(private readonly db: PrismaClient) {}

  private static _toRead(user: User): UserRecord {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  private static _toStore(user: User): UserStoreRecord {
    return {
      ...UserRepository._toRead(user),
      passwordHash: user.passwordHash,
    };
  }

  public async create(data: CreateUserInput): Promise<UserRecord> {
    const user = await this.db.user.create({
      data: {
        username: data.username,
        passwordHash: data.passwordHash ?? null,
        fullName: data.fullName ?? null,
        isActive: data.isActive ?? true,
      },
    });
    return UserRepository._toRead(user);
  }

  public async getById(id: string): Promise<UserRecord | null> {
    const user = await this.db.user.findUnique({where: {id}});
    return user ? UserRepository._toRead(user) : null;
  }

  public async getByUsername(
    username: string,
  ): Promise<UserStoreRecord | null> {
    const user = await this.db.user.findUnique({where: {username}});
    return user ? UserRepository._toStore(user) : null;
  }

  public async getAll(): Promise<UserRecord[]> {
    const users = await this.db.user.findMany({
      orderBy: {createdAt: 'desc'},
    });
    return users.map((user) => UserRepository._toRead(user));
  }

  public async setActiveStatus(
    id: string,
    isActive: boolean,
  ): Promise<UserRecord> {
    const user = await this.db.user.update({
      where: {id},
      data: {isActive},
    });
    return UserRepository._toRead(user);
  }

  public async assignRole(userId: string, roleId: number): Promise<void> {
    await this.db.userRole.upsert({
      where: {
        userId_roleId: {userId, roleId},
      },
      update: {},
      create: {
        userId,
        roleId,
      },
    });
  }

  public async revokeRole(userId: string, roleId: number): Promise<void> {
    await this.db.userRole.deleteMany({
      where: {
        userId,
        roleId,
      },
    });
  }

  public async getAccessConfig(
    userId: string,
  ): Promise<UserAccessConfig | null> {
    const user = await this.db.user.findUnique({
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

    if (!user) {
      return null;
    }

    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.name),
    );

    return {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      isActive: user.isActive,
      roles: [...new Set(roles)],
      permissions: [...new Set(permissions)],
    };
  }
}
