import {describe, it, expect, jest} from '@jest/globals';
import type {FastifyRequest} from 'fastify';
import {
  authenticateRequest,
  expressAuthMiddleware,
  verifyTokenHook,
  JwtService,
  InvalidTokenError,
  AccessDeniedError,
  type HttpRequestLike,
  type HttpResponseLike,
  type NextFunctionLike,
} from '../src/index.js';

describe('Framework-Agnostic HTTP Authentication Layer Tests', () => {
  const validToken = JwtService.generateToken({
    userId: 'user-456',
    username: 'dr_watson',
    name: 'John Watson',
    roles: ['Researcher'],
    permissions: ['read:articles'],
  });

  describe('authenticateRequest', () => {
    it('should authenticate a generic request without Fastify dependency', async () => {
      const mockReq: HttpRequestLike = {
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      };

      const payload = await authenticateRequest(mockReq, ['Researcher']);
      expect(payload.username).toBe('dr_watson');
      expect(mockReq.user).toEqual(payload);
    });

    it('should throw InvalidTokenError if authorization header is missing', async () => {
      const mockReq: HttpRequestLike = {
        headers: {},
      };

      await expect(authenticateRequest(mockReq)).rejects.toThrow(
        InvalidTokenError,
      );
    });

    it('should throw AccessDeniedError if required role is missing', async () => {
      const mockReq: HttpRequestLike = {
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      };

      await expect(authenticateRequest(mockReq, ['Admin'])).rejects.toThrow(
        AccessDeniedError,
      );
    });
  });

  describe('expressAuthMiddleware', () => {
    it('should call next() on valid token and role for Express-like apps', async () => {
      const mockReq: HttpRequestLike = {
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      const middleware = expressAuthMiddleware(['Researcher']);
      await middleware(
        mockReq,
        mockRes as unknown as HttpResponseLike,
        mockNext as unknown as NextFunctionLike,
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      const mockReq: HttpRequestLike = {
        headers: {
          authorization: 'Bearer invalid.token.value',
        },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      const middleware = expressAuthMiddleware();
      await middleware(
        mockReq,
        mockRes as unknown as HttpResponseLike,
        mockNext as unknown as NextFunctionLike,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when role is insufficient', async () => {
      const mockReq: HttpRequestLike = {
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      const middleware = expressAuthMiddleware(['SuperAdmin']);
      await middleware(
        mockReq,
        mockRes as unknown as HttpResponseLike,
        mockNext as unknown as NextFunctionLike,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('verifyTokenHook (Fastify compatibility)', () => {
    it('should export verifyTokenHook and allow valid requests', async () => {
      const mockFastifyReq = {
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      };

      const hook = verifyTokenHook(['Researcher']);
      await expect(
        hook(mockFastifyReq as unknown as FastifyRequest),
      ).resolves.toBeUndefined();
    });
  });
});
