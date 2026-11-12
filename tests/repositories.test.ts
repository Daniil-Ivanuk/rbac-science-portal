import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import type {PrismaClient} from '@prisma/client';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-key-for-repos';

import {
  UserRepository,
  RoleRepository,
  PermissionRepository,
  ArticleRepository,
  AuthService,
  ArticleService,
  RoleService,
  RoleCacheService,
  hashPassword,
  verifyPassword,
  ValidationError,
  ConflictError,
  InvalidTokenError,
  AccessDeniedError,
  EntityNotFoundError,
} from '../src/index.js';

describe('Password Security & Repository/Service Layer Tests', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('Security (scrypt password hashing)', () => {
    it('should hash password with salt and verify matching password', async () => {
      const hash = await hashPassword('StrongPass123!');
      expect(hash).toContain(':');

      await expect(verifyPassword('StrongPass123!', hash)).resolves.toBe(true);
      await expect(verifyPassword('WrongPass!', hash)).resolves.toBe(false);
      await expect(verifyPassword('StrongPass123!', 'malformed')).resolves.toBe(
        false,
      );
    });
  });

  describe('Repositories', () => {
    it('UserRepository should omit passwordHash in getById and expose it in getByUsername', async () => {
      const createdAt = new Date();
      const mockDb = {
        user: {
          findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
            id: 'user-uuid-1',
            username: 'dr_smith',
            passwordHash: 'salt:secret_hash',
            fullName: 'Dr. Smith',
            isActive: true,
            createdAt,
          }),
        },
      } as unknown as PrismaClient;

      const repo = new UserRepository(mockDb);

      const publicUser = await repo.getById('user-uuid-1');
      expect(publicUser).toEqual({
        id: 'user-uuid-1',
        username: 'dr_smith',
        fullName: 'Dr. Smith',
        isActive: true,
        createdAt,
      });
      expect(
        (publicUser as unknown as {passwordHash?: string}).passwordHash,
      ).toBeUndefined();

      const storeUser = await repo.getByUsername('dr_smith');
      expect(storeUser?.passwordHash).toBe('salt:secret_hash');
    });

    it('RoleRepository should return null for missing role and mapped permissions for existing role', async () => {
      const mockDb = {
        role: {
          findUnique: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
              id: 1,
              name: 'Researcher',
              description: null,
              createdAt: new Date(),
              permissions: [
                {permission: {name: 'read:articles'}},
                {permission: {name: 'write:articles'}},
              ],
            }),
        },
      } as unknown as PrismaClient;

      const repo = new RoleRepository(mockDb);

      await expect(repo.getPermissionsByRoleName('Ghost')).resolves.toBeNull();
      await expect(
        repo.getPermissionsByRoleName('Researcher'),
      ).resolves.toEqual(['read:articles', 'write:articles']);
    });

    it('PermissionRepository and ArticleRepository should map records cleanly', async () => {
      const now = new Date();
      const mockDb = {
        permission: {
          findMany: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue([
              {id: 1, name: 'read:articles', resource: 'articles'},
            ]),
        },
        article: {
          findMany: jest.fn<() => Promise<unknown>>().mockResolvedValue([
            {
              id: 10,
              title: 'Quantum Computing Notes',
              content: 'Abstract...',
              isPublished: true,
              authorId: 'u1',
              createdAt: now,
              updatedAt: now,
              author: {username: 'alice', fullName: 'Alice'},
            },
          ]),
        },
      } as unknown as PrismaClient;

      const permRepo = new PermissionRepository(mockDb);
      const articleRepo = new ArticleRepository(mockDb);

      const perms = await permRepo.getAll();
      expect(perms).toEqual([
        {id: 1, name: 'read:articles', resource: 'articles'},
      ]);

      const articles = await articleRepo.getAll();
      expect(articles[0]).toMatchObject({
        id: 10,
        title: 'Quantum Computing Notes',
        authorUsername: 'alice',
        authorFullName: 'Alice',
      });
    });
  });

  describe('AuthService', () => {
    it('should validate registration payload and reject duplicate usernames', async () => {
      const mockDb = {
        user: {
          findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
            id: 'u1',
            username: 'existing',
            passwordHash: 'a:b',
            fullName: null,
            isActive: true,
            createdAt: new Date(),
          }),
        },
      } as unknown as PrismaClient;

      const authService = new AuthService(mockDb);

      await expect(
        authService.register({username: 'ab', password: 'password123'}),
      ).rejects.toThrow(ValidationError);

      await expect(
        authService.register({username: 'user1', password: '123'}),
      ).rejects.toThrow(ValidationError);

      await expect(
        authService.register({username: 'existing', password: 'password123'}),
      ).rejects.toThrow(ConflictError);
    });

    it('should reject wrong password and deactivated account, and issue JWT on valid login', async () => {
      const validHash = await hashPassword('CorrectPass123!');
      const mockDb = {
        user: {
          findUnique: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValueOnce({
              id: 'u1',
              username: 'ivan',
              passwordHash: validHash,
              fullName: 'Ivan',
              isActive: true,
              createdAt: new Date(),
            })
            .mockResolvedValueOnce({
              id: 'u2',
              username: 'blocked_user',
              passwordHash: validHash,
              fullName: 'Blocked',
              isActive: false,
              createdAt: new Date(),
            })
            .mockResolvedValueOnce({
              id: 'u1',
              username: 'ivan',
              passwordHash: validHash,
              fullName: 'Ivan',
              isActive: true,
              createdAt: new Date(),
            })
            .mockResolvedValueOnce({
              id: 'u1',
              username: 'ivan',
              fullName: 'Ivan',
              isActive: true,
              roles: [
                {
                  role: {
                    name: 'Researcher',
                    permissions: [{permission: {name: 'read:articles'}}],
                  },
                },
              ],
            }),
        },
      } as unknown as PrismaClient;

      const authService = new AuthService(mockDb);

      await expect(authService.login('ivan', 'WrongPass!')).rejects.toThrow(
        InvalidTokenError,
      );

      await expect(
        authService.login('blocked_user', 'CorrectPass123!'),
      ).rejects.toThrow(AccessDeniedError);

      const loginResult = await authService.login('ivan', 'CorrectPass123!');
      expect(loginResult.tokenType).toBe('Bearer');
      expect(loginResult.accessToken.length).toBeGreaterThan(20);
      expect(loginResult.user.roles).toEqual(['Researcher']);
      expect(loginResult.user.permissions).toEqual(['read:articles']);
    });
  });

  describe('ArticleService & RoleService cache invalidation', () => {
    it('ArticleService should enforce ownership for non-admin updates and throw 404 when missing', async () => {
      const now = new Date();
      const mockDb = {
        article: {
          findUnique: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
              id: 5,
              title: 'Paper',
              content: 'Text',
              isPublished: true,
              authorId: 'author-1',
              createdAt: now,
              updatedAt: now,
            }),
          update: jest.fn<() => Promise<unknown>>().mockResolvedValue({
            id: 5,
            title: 'Updated Paper',
            content: 'Text',
            isPublished: true,
            authorId: 'author-1',
            createdAt: now,
            updatedAt: now,
          }),
        },
      } as unknown as PrismaClient;

      const articleService = new ArticleService(mockDb);

      await expect(articleService.getArticleById(999)).rejects.toThrow(
        EntityNotFoundError,
      );

      await expect(
        articleService.updateArticle(5, {title: 'Hack'}, 'other-user', false),
      ).rejects.toThrow(AccessDeniedError);
    });

    it('RoleService should invalidate Redis cache when assigning permissions to a role', async () => {
      const invalidateSpy = jest
        .spyOn(RoleCacheService, 'invalidateRoleCache')
        .mockResolvedValue();

      const mockDb = {
        role: {
          findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
            id: 1,
            name: 'Editor',
            description: null,
            createdAt: new Date(),
          }),
        },
        permission: {
          findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
            id: 2,
            name: 'write:articles',
            resource: 'articles',
          }),
        },
        rolePermission: {
          upsert: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
        },
      } as unknown as PrismaClient;

      const roleService = new RoleService(mockDb);
      await roleService.assignPermissionToRole(1, 2);

      expect(invalidateSpy).toHaveBeenCalledWith('Editor');
    });
  });
});
