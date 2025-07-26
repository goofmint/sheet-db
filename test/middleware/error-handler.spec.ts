import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/error-handler';
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, InternalError } from '../../src/utils/errors';
import { HTTPException } from 'hono/http-exception';
import { Context } from 'hono';
import type { Env } from '../../src/types';

describe('Error Handler Middleware', () => {
  it('should handle AppError and return JSON response', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // モックコンテキストを作成
    const mockContext = {
      json: vi.fn((object, status) => ({ json: object, status })),
      get: vi.fn(),
      env: {}
    } as unknown as Context<{ Bindings: Env }>;
    
    // エラーをスローするnext関数
    const next = vi.fn().mockRejectedValue(new ValidationError('Test error', { field: 'email' }));
    
    // ミドルウェアを実行
    const middleware = errorHandler();
    const result = await middleware(mockContext, next);
    
    // 検証
    expect(mockContext.json).toHaveBeenCalledWith(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Test error',
          details: { field: 'email' },
          timestamp: expect.any(String),
          requestId: undefined
        }
      },
      400
    );
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should handle generic Error in production mode', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const mockContext = {
      json: vi.fn((object, status) => ({ json: object, status })),
      get: vi.fn(),
      env: { NODE_ENV: 'production' }
    } as unknown as Context<{ Bindings: Env }>;
    
    const next = vi.fn().mockRejectedValue(new Error('Secret error'));
    
    const middleware = errorHandler();
    await middleware(mockContext, next);
    
    expect(mockContext.json).toHaveBeenCalledWith(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: undefined,
          timestamp: expect.any(String),
          requestId: undefined
        }
      },
      500
    );
    
    consoleSpy.mockRestore();
  });

  it('should handle generic Error in development mode', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const mockContext = {
      json: vi.fn((object, status) => ({ json: object, status })),
      get: vi.fn(),
      env: { NODE_ENV: 'development' }
    } as unknown as Context<{ Bindings: Env }>;
    
    const testError = new Error('Secret error');
    const next = vi.fn().mockRejectedValue(testError);
    
    const middleware = errorHandler();
    await middleware(mockContext, next);
    
    const callArgs = (mockContext.json as any).mock.calls[0];
    expect(callArgs[0].error.code).toBe('INTERNAL_ERROR');
    expect(callArgs[0].error.message).toBe('Internal server error');
    expect(callArgs[0].error.details.message).toBe('Secret error');
    expect(callArgs[0].error.details.stack).toBeDefined();
    expect(callArgs[1]).toBe(500);
    
    consoleSpy.mockRestore();
  });

  it('should pass through successful requests', async () => {
    const mockContext = {
      json: vi.fn(),
      get: vi.fn(),
      env: {}
    } as unknown as Context<{ Bindings: Env }>;
    
    const next = vi.fn().mockResolvedValue(undefined);
    
    const middleware = errorHandler();
    await middleware(mockContext, next);
    
    expect(next).toHaveBeenCalled();
    expect(mockContext.json).not.toHaveBeenCalled();
  });

  it('should handle NotFoundError', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const mockContext = {
      json: vi.fn((object, status) => ({ json: object, status })),
      get: vi.fn(),
      env: {}
    } as unknown as Context<{ Bindings: Env }>;
    
    const next = vi.fn().mockRejectedValue(new NotFoundError('User'));
    
    const middleware = errorHandler();
    await middleware(mockContext, next);
    
    expect(mockContext.json).toHaveBeenCalledWith(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
          details: undefined,
          timestamp: expect.any(String),
          requestId: undefined
        }
      },
      404
    );
    
    consoleSpy.mockRestore();
  });

  it('should handle UnauthorizedError', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const mockContext = {
      json: vi.fn((object, status) => ({ json: object, status })),
      get: vi.fn(),
      env: {}
    } as unknown as Context<{ Bindings: Env }>;
    
    const next = vi.fn().mockRejectedValue(new UnauthorizedError('Invalid token'));
    
    const middleware = errorHandler();
    await middleware(mockContext, next);
    
    expect(mockContext.json).toHaveBeenCalledWith(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
          details: undefined,
          timestamp: expect.any(String),
          requestId: undefined
        }
      },
      401
    );
    
    consoleSpy.mockRestore();
  });

  it('should handle ForbiddenError', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const mockContext = {
      json: vi.fn((object, status) => ({ json: object, status })),
      get: vi.fn(),
      env: {}
    } as unknown as Context<{ Bindings: Env }>;
    
    const next = vi.fn().mockRejectedValue(new ForbiddenError('Access denied'));
    
    const middleware = errorHandler();
    await middleware(mockContext, next);
    
    expect(mockContext.json).toHaveBeenCalledWith(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied',
          details: undefined,
          timestamp: expect.any(String),
          requestId: undefined
        }
      },
      403
    );
    
    consoleSpy.mockRestore();
  });

  it('should handle HTTPException', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const mockContext = {
      json: vi.fn((object, status) => ({ json: object, status })),
      get: vi.fn(),
      env: { NODE_ENV: 'production' }
    } as unknown as Context<{ Bindings: Env }>;
    
    const next = vi.fn().mockRejectedValue(new HTTPException(404, { message: 'Not found' }));
    
    const middleware = errorHandler();
    await middleware(mockContext, next);
    
    expect(mockContext.json).toHaveBeenCalledWith(
      {
        error: {
          code: 'HTTP_ERROR',
          message: 'An error occurred',
          timestamp: expect.any(String),
          requestId: undefined
        }
      },
      404
    );
    
    consoleSpy.mockRestore();
  });

  it('should handle HTTPException in development', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const mockContext = {
      json: vi.fn((object, status) => ({ json: object, status })),
      get: vi.fn(),
      env: { NODE_ENV: 'development' }
    } as unknown as Context<{ Bindings: Env }>;
    
    const httpError = new HTTPException(404, { message: 'Not found' });
    const next = vi.fn().mockRejectedValue(httpError);
    
    const middleware = errorHandler();
    await middleware(mockContext, next);
    
    expect(mockContext.json).toHaveBeenCalledWith(
      {
        error: {
          code: 'HTTP_ERROR',
          message: 'Not found',
          timestamp: expect.any(String),
          requestId: undefined
        }
      },
      404
    );
    
    consoleSpy.mockRestore();
  });
});