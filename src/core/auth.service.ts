import type {PrismaClient} from '@prisma/client';
import {prisma} from '../db/prisma.client.js';
import {RbacContext} from './context.js';
import {
  AccessDeniedError,
  ConflictError,
  EntityNotFoundError,
  InvalidTokenError,
  ValidationError,
} from './errors.js';
import {JwtService} from './jwt.service.js';
import {hashPassword, verifyPassword} from './security.js';
import {TokenBlacklistService} from '../cache/token.blacklist.service.js';
import {
  UserRepository,
  type UserAccessConfig,
} from '../repositories/user.repository.js';
import {RoleRepository} from '../repositories/role.repository.js';

export interface RegisterInput {
  username: string;
  password: string;
  fullName?: string | undefined;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  user: UserAccessConfig;
}

export class AuthService {
  private readonly userRepo: UserRepository;
  private readonly roleRepo: RoleRepository;

  constructor(db?: PrismaClient) {
    const client = db || RbacContext.db || prisma;
    this.userRepo = new UserRepository(client);
    this.roleRepo = new RoleRepository(client);
  }

  public async register(input: RegisterInput): Promise<UserAccessConfig> {
    const username = input.username?.trim();
    if (!username || username.length < 3) {
      throw new ValidationError('Username must be at least 3 characters long');
    }
    if (!input.password || input.password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long');
    }

    const existing = await this.userRepo.getByUsername(username);
    if (existing) {
      throw new ConflictError(`User "${username}" already exists`);
    }

    const passwordHash = await hashPassword(input.password);
    const createdUser = await this.userRepo.create({
      username,
      passwordHash,
      fullName: input.fullName?.trim() || null,
    });

    const defaultRole = await this.roleRepo.getByName('Researcher');
    if (defaultRole) {
      await this.userRepo.assignRole(createdUser.id, defaultRole.id);
    }

    const accessConfig = await this.userRepo.getAccessConfig(createdUser.id);
    if (!accessConfig) {
      throw new EntityNotFoundError('Failed to load created user profile');
    }

    return accessConfig;
  }

  public async login(username: string, password: string): Promise<LoginResult> {
    const trimmedUsername = username?.trim();
    if (!trimmedUsername || !password) {
      throw new ValidationError('Username and password are required');
    }

    const user = await this.userRepo.getByUsername(trimmedUsername);
    if (!user || !user.passwordHash) {
      throw new InvalidTokenError('Invalid username or password');
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new InvalidTokenError('Invalid username or password');
    }

    if (!user.isActive) {
      throw new AccessDeniedError('User account is deactivated');
    }

    const accessConfig = await this.userRepo.getAccessConfig(user.id);
    if (!accessConfig) {
      throw new EntityNotFoundError('User profile not found');
    }

    const accessToken = JwtService.generateToken({
      userId: accessConfig.userId,
      username: accessConfig.username,
      name: accessConfig.fullName || accessConfig.username,
      roles: accessConfig.roles,
      permissions: accessConfig.permissions,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      user: accessConfig,
    };
  }

  public async logout(token: string, expSeconds?: number): Promise<void> {
    const currentSeconds = Math.floor(Date.now() / 1000);
    const ttl = expSeconds ? expSeconds - currentSeconds : 3600;
    await TokenBlacklistService.blacklistToken(token, ttl);
  }

  public async getCurrentUser(userId: string): Promise<UserAccessConfig> {
    const accessConfig = await this.userRepo.getAccessConfig(userId);
    if (!accessConfig) {
      throw new EntityNotFoundError('User not found');
    }
    return accessConfig;
  }
}
