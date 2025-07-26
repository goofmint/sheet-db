import { describe, it, expect } from 'vitest';
import { 
  getErrorCode, 
  getGenericErrorMessage, 
  createErrorHandler, 
  createNotFoundHandler 
} from '../../src/lib/error-handlers';
import { HTTPException } from 'hono/http-exception';
import { Hono } from 'hono';

describe('Error Handlers', () => {
  describe('getErrorCode', () => {
    it('should return descriptive error codes for known status codes', () => {
      expect(getErrorCode(400)).toBe('BAD_REQUEST');
      expect(getErrorCode(401)).toBe('UNAUTHORIZED');
      expect(getErrorCode(403)).toBe('FORBIDDEN');
      expect(getErrorCode(404)).toBe('NOT_FOUND');
      expect(getErrorCode(500)).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should return HTTP_xxx for unknown status codes', () => {
      expect(getErrorCode(418)).toBe('HTTP_418');
      expect(getErrorCode(999)).toBe('HTTP_999');
    });
  });

  describe('getGenericErrorMessage', () => {
    it('should return generic messages for known status codes', () => {
      expect(getGenericErrorMessage(400)).toBe('The request could not be processed due to invalid data.');
      expect(getGenericErrorMessage(401)).toBe('Authentication is required to access this resource.');
      expect(getGenericErrorMessage(404)).toBe('The requested resource could not be found.');
    });

    it('should return generic message for unknown status codes', () => {
      expect(getGenericErrorMessage(418)).toBe('An error occurred while processing your request.');
    });
  });

  describe('createErrorHandler', () => {
    it('should handle HTTPException correctly', async () => {
      const app = new Hono();
      app.onError(createErrorHandler());
      
      app.get('/test', () => {
        throw new HTTPException(400, { message: 'Invalid input' });
      });

      const response = await app.request('/test');
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toBe('Invalid input');
      expect(body.error.timestamp).toBeDefined();
    });

    it('should handle generic errors correctly', async () => {
      const app = new Hono();
      app.onError(createErrorHandler());
      
      app.get('/test', () => {
        throw new Error('Database error');
      });

      const response = await app.request('/test');
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(body.error.message).toBe('An unexpected error occurred. Please try again later.');
      expect(body.error.timestamp).toBeDefined();
    });

    it('should use generic messages in production for HTTP exceptions', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const app = new Hono();
      app.onError(createErrorHandler());
      
      app.get('/test', () => {
        throw new HTTPException(401, { message: 'Token is invalid or expired' });
      });

      const response = await app.request('/test');
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Authentication is required to access this resource.');
      expect(body.error.message).not.toBe('Token is invalid or expired');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('createNotFoundHandler', () => {
    it('should handle not found routes correctly', async () => {
      const app = new Hono();
      app.notFound(createNotFoundHandler());

      const response = await app.request('/nonexistent');
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Route not found');
      expect(body.error.path).toBe('/nonexistent');
      expect(body.error.timestamp).toBeDefined();
    });
  });
});