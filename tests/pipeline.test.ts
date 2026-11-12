import {describe, it, expect} from '@jest/globals';
import {
  JwtService,
  RoleService,
  AuthService,
  ArticleService,
  UserRepository,
  RoleRepository,
  PermissionRepository,
  ArticleRepository,
  RoleCacheService,
  TokenBlacklistService,
  RbacGuard,
  verifyTokenHook,
  expressAuthMiddleware,
  authenticateRequest,
  initRbacModule,
  InvalidTokenError,
  AccessDeniedError,
  RoleNotFoundError,
  EntityNotFoundError,
  ConflictError,
  ValidationError,
} from '../src/index.js';

describe('CI/CD Pipeline Smoke & Sanity Tests', () => {
  it('should successfully import and expose all core RBAC module exports', () => {
    expect(JwtService).toBeDefined();
    expect(RoleService).toBeDefined();
    expect(AuthService).toBeDefined();
    expect(ArticleService).toBeDefined();
    expect(UserRepository).toBeDefined();
    expect(RoleRepository).toBeDefined();
    expect(PermissionRepository).toBeDefined();
    expect(ArticleRepository).toBeDefined();
    expect(RoleCacheService).toBeDefined();
    expect(TokenBlacklistService).toBeDefined();
    expect(RbacGuard).toBeDefined();
    expect(verifyTokenHook).toBeDefined();
    expect(expressAuthMiddleware).toBeDefined();
    expect(authenticateRequest).toBeDefined();
    expect(initRbacModule).toBeDefined();
  });

  it('should expose custom error classes with correct hierarchy', () => {
    expect(new InvalidTokenError()).toBeInstanceOf(Error);
    expect(new AccessDeniedError()).toBeInstanceOf(Error);
    expect(new RoleNotFoundError()).toBeInstanceOf(Error);
    expect(new EntityNotFoundError()).toBeInstanceOf(Error);
    expect(new ConflictError()).toBeInstanceOf(Error);
    expect(new ValidationError()).toBeInstanceOf(Error);
  });
});
