import {describe, it, expect} from '@jest/globals';
import {JwtService, type JwtPayload} from '../src/core/jwt.service.js';
import {RbacGuard} from '../src/core/rbac.guard.js';

describe('RBAC and JWT Core Tests', () => {
  const mockUser: JwtPayload = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    username: 'researcher_ivan',
    roles: ['Researcher'],
    permissions: ['read:articles', 'write:articles'],
  };

  it('должен успешно генерировать и верифицировать JWT токен', () => {
    const token = JwtService.generateToken(mockUser);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);

    const decoded = JwtService.verifyToken(token);
    expect(decoded.username).toBe(mockUser.username);
    expect(decoded.roles).toEqual(mockUser.roles);
    expect(decoded.permissions).toEqual(mockUser.permissions);
  });

  it('должен выбрасывать ошибку при валидации неверного токена', () => {
    expect(() => {
      JwtService.verifyToken('invalid.token.string');
    }).toThrow('Invalid or expired JWT token');
  });

  it('должен корректно проверять права доступа (RbacGuard)', () => {
    // Пользователь имеет право 'read:articles'
    expect(RbacGuard.hasPermission(mockUser, 'read:articles')).toBe(true);

    // У пользователя нет права 'delete:users'
    expect(RbacGuard.hasPermission(mockUser, 'delete:users')).toBe(false);

    // Проверка ролей
    expect(RbacGuard.hasRole(mockUser, ['Admin', 'Researcher'])).toBe(true);
    expect(RbacGuard.hasRole(mockUser, ['Admin'])).toBe(false);
  });
});
