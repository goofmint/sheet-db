import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  InternalError,
  ConflictError
} from '../../src/utils/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create AppError with default status code', () => {
      const error = new AppError('TEST_ERROR', 'Test error message');
      
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.statusCode).toBe(500);
      expect(error.details).toBeUndefined();
      expect(error.name).toBe('AppError');
    });

    it('should create AppError with custom status code and details', () => {
      const details = { field: 'email', value: 'invalid' };
      const error = new AppError('CUSTOM_ERROR', 'Custom error', 422, details);
      
      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(422);
      expect(error.details).toEqual(details);
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with 400 status code', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
    });

    it('should create ValidationError with details', () => {
      const details = { email: 'invalid', password: 'too short' };
      const error = new ValidationError('Validation failed', details);
      
      expect(error.details).toEqual(details);
    });
  });

  describe('NotFoundError', () => {
    it('should create NotFoundError with 404 status code', () => {
      const error = new NotFoundError('User');
      
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create UnauthorizedError with default message', () => {
      const error = new UnauthorizedError();
      
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should create UnauthorizedError with custom message', () => {
      const error = new UnauthorizedError('Invalid token');
      
      expect(error.message).toBe('Invalid token');
    });
  });

  describe('ForbiddenError', () => {
    it('should create ForbiddenError with default message', () => {
      const error = new ForbiddenError();
      
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('ForbiddenError');
    });

    it('should create ForbiddenError with custom message', () => {
      const error = new ForbiddenError('Access denied to admin panel');
      
      expect(error.message).toBe('Access denied to admin panel');
    });
  });

  describe('InternalError', () => {
    it('should create InternalError with default message', () => {
      const error = new InternalError();
      
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message).toBe('Internal server error');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('InternalError');
    });

    it('should create InternalError with custom message and details', () => {
      const details = { service: 'database', error: 'connection timeout' };
      const error = new InternalError('Database error', details);
      
      expect(error.message).toBe('Database error');
      expect(error.details).toEqual(details);
    });
  });

  describe('ConflictError', () => {
    it('should create ConflictError with 409 status code', () => {
      const error = new ConflictError('Resource already exists');
      
      expect(error.code).toBe('CONFLICT');
      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.name).toBe('ConflictError');
    });

    it('should create ConflictError with details', () => {
      const details = { resource: 'user', field: 'email' };
      const error = new ConflictError('Email already in use', details);
      
      expect(error.details).toEqual(details);
    });
  });

  describe('Error inheritance', () => {
    it('should be instance of Error', () => {
      const error = new AppError('TEST', 'Test');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should maintain proper prototype chain', () => {
      const validationError = new ValidationError('Test');
      const notFoundError = new NotFoundError('Test');
      
      expect(validationError).toBeInstanceOf(Error);
      expect(validationError).toBeInstanceOf(AppError);
      expect(validationError).toBeInstanceOf(ValidationError);
      
      expect(notFoundError).toBeInstanceOf(Error);
      expect(notFoundError).toBeInstanceOf(AppError);
      expect(notFoundError).toBeInstanceOf(NotFoundError);
    });
  });
});