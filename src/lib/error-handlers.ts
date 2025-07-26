import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

// HTTP status code to descriptive error code mapping
export const getErrorCode = (status: number): string => {
  const errorCodes: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT'
  };
  return errorCodes[status] || `HTTP_${status}`;
};

// Generic error messages for production to avoid exposing sensitive information
export const getGenericErrorMessage = (status: number): string => {
  const genericMessages: Record<number, string> = {
    400: 'The request could not be processed due to invalid data.',
    401: 'Authentication is required to access this resource.',
    403: 'You do not have permission to access this resource.',
    404: 'The requested resource could not be found.',
    405: 'The request method is not supported for this resource.',
    409: 'The request conflicts with the current state of the resource.',
    422: 'The request contains invalid or missing data.',
    429: 'Too many requests. Please try again later.',
    500: 'An internal server error occurred.',
    502: 'Bad gateway error occurred.',
    503: 'The service is temporarily unavailable.',
    504: 'Gateway timeout occurred.'
  };
  return genericMessages[status] || 'An error occurred while processing your request.';
};

// Structured logging function
export const logError = (error: Error, context?: Record<string, unknown>) => {
  const logEntry = {
    level: 'error',
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context
  };
  console.error(JSON.stringify(logEntry));
};

// Main error handler
export const createErrorHandler = () => {
  return (err: Error, c: Context) => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (err instanceof HTTPException) {
      // Log HTTP exceptions in structured format
      logError(err, {
        type: 'http_exception',
        status: err.status,
        path: c.req.path,
        method: c.req.method
      });

      return c.json({
        error: {
          code: getErrorCode(err.status),
          message: isProduction ? getGenericErrorMessage(err.status) : err.message,
          timestamp: new Date().toISOString()
        }
      }, err.status);
    }

    // Log internal errors with full context
    logError(err, {
      type: 'internal_error',
      path: c.req.path,
      method: c.req.method,
      userAgent: c.req.header('user-agent')
    });
    
    return c.json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
        timestamp: new Date().toISOString()
      }
    }, 500);
  };
};

// Not found handler
export const createNotFoundHandler = () => {
  return (c: Context) => {
    return c.json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        path: c.req.path,
        timestamp: new Date().toISOString()
      }
    }, 404);
  };
};