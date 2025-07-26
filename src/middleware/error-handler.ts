import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AppError } from '../utils/errors';

/**
 * Error response format
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Error handler middleware
 * Catches all errors and returns a consistent error response format
 */
export function errorHandler() {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (error) {
      console.error('Error caught by middleware:', error);
      
      // 環境判定を最初に行う
      const isDevelopment = c.env?.NODE_ENV !== 'production';
      
      // HTTPExceptionの場合
      if (error instanceof HTTPException) {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'HTTP_ERROR',
            message: isDevelopment ? error.message : 'An error occurred',
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId')
          }
        };
        
        return c.json(errorResponse, error.status);
      }
      
      // AppErrorの場合
      if (error instanceof AppError) {
        const errorResponse: ErrorResponse = {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
            timestamp: new Date().toISOString(),
            requestId: c.get('requestId')
          }
        };
        
        return c.json(errorResponse, error.statusCode);
      }
      
      // 予期しないエラーの場合
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: isDevelopment ? {
            stack: error instanceof Error ? error.stack : undefined,
            message: error instanceof Error ? error.message : 'Unknown error'
          } : undefined,
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId')
        }
      };
      
      return c.json(errorResponse, 500);
    }
  };
}