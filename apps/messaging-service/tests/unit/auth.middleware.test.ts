/**
 * Unit Tests - Authentication Middleware
 */

import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware, optionalAuthMiddleware, checkConversationAccess } from '../../src/middleware/auth.js';
import { generateTestToken, generateExpiredToken, generateInvalidToken, testUsers } from '../helpers/jwt.helper.js';

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis() as unknown as (code: number) => Response,
      json: jest.fn().mockReturnThis() as unknown as (body: any) => Response,
    };
    nextFunction = jest.fn();
  });

  describe('authMiddleware', () => {
    it('should authenticate valid JWT token', async () => {
      const token = generateTestToken(testUsers.don);
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await authMiddleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).userId).toBe(testUsers.don.id);
      expect((mockRequest as any).user).toMatchObject({
        id: testUsers.don.id,
        email: testUsers.don.email,
      });
    });

    it('should reject request without authorization header', async () => {
      await authMiddleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized - No token provided',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token',
      };

      await authMiddleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized - No token provided',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject expired JWT token', async () => {
      const token = generateExpiredToken(testUsers.don);
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await authMiddleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized - Token verification failed',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject invalid JWT token', async () => {
      const token = generateInvalidToken();
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await authMiddleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized - Token verification failed',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject malformed JWT token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer not.a.valid.jwt',
      };

      await authMiddleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 500 when NEXTAUTH_SECRET is missing', async () => {
      const originalSecret = process.env.NEXTAUTH_SECRET;
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.AUTH_SECRET;

      const token = generateTestToken(testUsers.don);
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await authMiddleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Server configuration error',
      });
      expect(nextFunction).not.toHaveBeenCalled();

      process.env.NEXTAUTH_SECRET = originalSecret;
    });
  });

  describe('optionalAuthMiddleware', () => {
    it('should authenticate valid JWT token', async () => {
      const token = generateTestToken(testUsers.shammah);
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await optionalAuthMiddleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).userId).toBe(testUsers.shammah.id);
      expect((mockRequest as any).user).toMatchObject({
        id: testUsers.shammah.id,
        email: testUsers.shammah.email,
      });
    });

    it('should continue without authentication when no token provided', async () => {
      await optionalAuthMiddleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).userId).toBeUndefined();
      expect((mockRequest as any).user).toBeUndefined();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication for invalid token', async () => {
      const token = generateInvalidToken();
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await optionalAuthMiddleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).userId).toBeUndefined();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication for expired token', async () => {
      const token = generateExpiredToken(testUsers.shammah);
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await optionalAuthMiddleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).userId).toBeUndefined();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('checkConversationAccess', () => {
    it('should allow access when user ID matches', () => {
      (mockRequest as any).userId = testUsers.don.id;
      mockRequest.params = { userId: testUsers.don.id };

      const middleware = checkConversationAccess();
      middleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access when user ID does not match', () => {
      (mockRequest as any).userId = testUsers.don.id;
      mockRequest.params = { userId: testUsers.shammah.id };

      const middleware = checkConversationAccess();
      middleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden - Cannot access other users\' conversations',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when userId is not set', () => {
      mockRequest.params = { userId: testUsers.don.id };

      const middleware = checkConversationAccess();
      middleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow access when no targetUserId is provided', () => {
      (mockRequest as any).userId = testUsers.don.id;
      mockRequest.params = {};
      mockRequest.body = {};

      const middleware = checkConversationAccess();
      middleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should check custom participant key', () => {
      (mockRequest as any).userId = testUsers.don.id;
      mockRequest.params = {};
      mockRequest.body = { senderId: testUsers.don.id };

      const middleware = checkConversationAccess('senderId');
      middleware(
        mockRequest as any,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});

