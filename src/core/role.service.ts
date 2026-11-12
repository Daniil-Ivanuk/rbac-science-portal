import type {PrismaClient} from '@prisma/client';
import {prisma} from '../db/prisma.client.js';
import {RbacContext} from './context.js';
import {
  ConflictError,
  EntityNotFoundError,
  RoleNotFoundError,
} from './errors.js';
import {RoleCacheService} from '../cache/role.cache.service.js';
import {
  RoleRepository,
  type RoleRecord,
  type RoleWithPermissions,
} from '../repositories/role.repository.js';
import {
  PermissionRepository,
  type PermissionRecord,
} from '../repositories/permission.repository.js';
import {
  UserRepository,
  type UserAccessConfig,
  type UserRecord,
} from '../repositories/user.repository.js';

export class RoleService {
  private readonly roleRepo: RoleRepository;
  private readonly permissionRepo: PermissionRepository;
  private readonly userRepo: UserRepository;

  constructor(db?: PrismaClient) {
    const client = db || RbacContext.db || prisma;
    this.roleRepo = new RoleRepository(client);
    this.permissionRepo = new PermissionRepository(client);
    this.userRepo = new UserRepository(client);
  }

  private static getDefaultInstance(): RoleService {
    return new RoleService();
  }

  public async createRole(
    name: string,
    description?: string | null,
  ): Promise<RoleRecord> {
    const existing = await this.roleRepo.getByName(name);
    if (existing) {
      throw new ConflictError(`Role "${name}" already exists`);
    }

    const role = await this.roleRepo.create(name, description);
    await RoleCacheService.updateRoleCache(role.name, []);
    return role;
  }

  public async getRoleByName(name: string): Promise<RoleRecord | null> {
    return this.roleRepo.getByName(name);
  }

  public async getAllRoles(): Promise<RoleWithPermissions[]> {
    return this.roleRepo.getAllWithPermissions();
  }

  public async deleteRole(roleId: number): Promise<void> {
    const role = await this.roleRepo.getById(roleId);
    if (!role) {
      throw new RoleNotFoundError(`Role with ID ${roleId} not found`);
    }

    await this.roleRepo.deleteById(roleId);
    await RoleCacheService.invalidateRoleCache(role.name);
  }

  public async createPermission(
    name: string,
    resource: string,
  ): Promise<PermissionRecord> {
    const existing = await this.permissionRepo.getByName(name);
    if (existing) {
      throw new ConflictError(`Permission "${name}" already exists`);
    }

    return this.permissionRepo.create(name, resource);
  }

  public async getPermissionByName(
    name: string,
  ): Promise<PermissionRecord | null> {
    return this.permissionRepo.getByName(name);
  }

  public async getAllPermissions(): Promise<PermissionRecord[]> {
    return this.permissionRepo.getAll();
  }

  public async assignPermissionToRole(
    roleId: number,
    permissionId: number,
  ): Promise<void> {
    const role = await this.roleRepo.getById(roleId);
    if (!role) {
      throw new RoleNotFoundError(`Role with ID ${roleId} not found`);
    }

    const permission = await this.permissionRepo.getById(permissionId);
    if (!permission) {
      throw new EntityNotFoundError(
        `Permission with ID ${permissionId} not found`,
      );
    }

    await this.permissionRepo.assignToRole(roleId, permissionId);
    await RoleCacheService.invalidateRoleCache(role.name);
  }

  public async revokePermissionFromRole(
    roleId: number,
    permissionId: number,
  ): Promise<void> {
    const role = await this.roleRepo.getById(roleId);
    if (!role) {
      throw new RoleNotFoundError(`Role with ID ${roleId} not found`);
    }

    await this.permissionRepo.revokeFromRole(roleId, permissionId);
    await RoleCacheService.invalidateRoleCache(role.name);
  }

  public async assignRoleToUser(userId: string, roleId: number): Promise<void> {
    const user = await this.userRepo.getById(userId);
    if (!user) {
      throw new EntityNotFoundError(`User with ID ${userId} not found`);
    }

    const role = await this.roleRepo.getById(roleId);
    if (!role) {
      throw new RoleNotFoundError(`Role with ID ${roleId} not found`);
    }

    await this.userRepo.assignRole(userId, roleId);
  }

  public async revokeRoleFromUser(
    userId: string,
    roleId: number,
  ): Promise<void> {
    const user = await this.userRepo.getById(userId);
    if (!user) {
      throw new EntityNotFoundError(`User with ID ${userId} not found`);
    }

    await this.userRepo.revokeRole(userId, roleId);
  }

  public async getAllUsers(): Promise<UserRecord[]> {
    return this.userRepo.getAll();
  }

  public async setUserActiveStatus(
    userId: string,
    isActive: boolean,
  ): Promise<UserRecord> {
    const user = await this.userRepo.getById(userId);
    if (!user) {
      throw new EntityNotFoundError(`User with ID ${userId} not found`);
    }

    return this.userRepo.setActiveStatus(userId, isActive);
  }

  public async getUserAccessConfig(
    userId: string,
  ): Promise<UserAccessConfig | null> {
    return this.userRepo.getAccessConfig(userId);
  }

  static async createRole(name: string, description?: string | null) {
    return this.getDefaultInstance().createRole(name, description);
  }

  static async getRoleByName(name: string) {
    return this.getDefaultInstance().getRoleByName(name);
  }

  static async getAllRoles() {
    return this.getDefaultInstance().getAllRoles();
  }

  static async deleteRole(roleId: number) {
    return this.getDefaultInstance().deleteRole(roleId);
  }

  static async createPermission(name: string, resource: string) {
    return this.getDefaultInstance().createPermission(name, resource);
  }

  static async getPermissionByName(name: string) {
    return this.getDefaultInstance().getPermissionByName(name);
  }

  static async getAllPermissions() {
    return this.getDefaultInstance().getAllPermissions();
  }

  static async assignPermissionToRole(roleId: number, permissionId: number) {
    return this.getDefaultInstance().assignPermissionToRole(
      roleId,
      permissionId,
    );
  }

  static async revokePermissionFromRole(roleId: number, permissionId: number) {
    return this.getDefaultInstance().revokePermissionFromRole(
      roleId,
      permissionId,
    );
  }

  static async assignRoleToUser(userId: string, roleId: number) {
    return this.getDefaultInstance().assignRoleToUser(userId, roleId);
  }

  static async revokeRoleFromUser(userId: string, roleId: number) {
    return this.getDefaultInstance().revokeRoleFromUser(userId, roleId);
  }

  static async getAllUsers() {
    return this.getDefaultInstance().getAllUsers();
  }

  static async setUserActiveStatus(userId: string, isActive: boolean) {
    return this.getDefaultInstance().setUserActiveStatus(userId, isActive);
  }

  static async getUserAccessConfig(userId: string) {
    return this.getDefaultInstance().getUserAccessConfig(userId);
  }
}
