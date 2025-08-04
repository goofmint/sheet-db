import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env } from '../types/env';
import { SessionService } from '../services/session';

/**
 * Authentication context that will be attached to Hono context
 */
export interface AuthContext {
  // User authentication
  userId?: string;
  sessionId?: string;
  isAuthenticated: boolean;
  
  // Master key authentication
  isMasterKey: boolean;
  
  // User roles (cached per request)
  roles?: string[];
}

/**
 * Authentication middleware options
 */
export interface AuthOptions {
  // Whether authentication is required (default: true)
  required?: boolean;
  
  // Allow master key authentication (default: true)
  allowMasterKey?: boolean;
}

/**
 * Create authentication middleware
 */
export function auth(options: AuthOptions = {}): MiddlewareHandler<{ Bindings: Env; Variables: { auth: AuthContext } }> {
  const {
    required = true,
    allowMasterKey = true
  } = options;

  return async (c, next) => {
    const authContext: AuthContext = {
      isAuthenticated: false,
      isMasterKey: false
    };

    // Attach auth context to Hono context
    c.set('auth', authContext);

    try {
      // 1. Check master key authentication first
      if (allowMasterKey) {
        const masterKey = c.req.header('x-master-key');
        if (masterKey) {
          // TODO: Replace with ACLService.validateMasterKey when ACL is implemented
          const configuredMasterKey = c.env?.MASTER_KEY;
          if (configuredMasterKey && masterKey === configuredMasterKey) {
            authContext.isAuthenticated = true;
            authContext.isMasterKey = true;
            return await next();
          }
          // Invalid master key - continue to session auth
        }
      }

      // 2. Check session cookie authentication
      const sessionId = getCookie(c, 'session');
      if (sessionId) {
        const validationResult = await SessionService.validateSession(sessionId);
        if (validationResult.success) {
          authContext.isAuthenticated = true;
          authContext.sessionId = sessionId;
          authContext.userId = validationResult.auth0UserId;
          
          // Pre-fetch user roles for this request
          // TODO: Implement with ACLService.getUserRoles(userId, context)
          authContext.roles = [];
        }
      }

      // 3. Check if authentication is required
      if (required && !authContext.isAuthenticated) {
        return defaultErrorResponse(c);
      }

      await next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      if (required) {
        return defaultErrorResponse(c);
      }
      // If auth is optional, continue even with errors
      await next();
    }
  };
}

/**
 * Default error response for unauthenticated requests
 */
function defaultErrorResponse(c: Context): Response {
  return c.json({
    success: false,
    error: 'unauthorized',
    message: 'Authentication required'
  }, 401);
}

/**
 * Helper middleware to require specific roles
 */
export function requireRoles(roles: string[]): MiddlewareHandler<{ Bindings: Env; Variables: { auth: AuthContext } }> {
  return async (c, next) => {
    const authContext = c.get('auth');

    // Master key bypasses role checks
    if (authContext.isMasterKey) {
      return await next();
    }

    if (!authContext.isAuthenticated) {
      return c.json({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
      }, 401);
    }

    // Check if user has required roles
    // TODO: Enhance with ACLService role checking when implemented
    const userRoles = authContext.roles || [];
    const hasRequiredRoles = roles.every(role => userRoles.includes(role));

    if (!hasRequiredRoles) {
      return c.json({
        success: false,
        error: 'forbidden',
        message: 'Insufficient permissions'
      }, 403);
    }

    await next();
  };
}

/**
 * Get authentication context from Hono context
 */
export function getAuth(c: Context): AuthContext {
  const ctx = c.get('auth');
  if (!ctx) throw new Error('Auth context missing – did you forget to mount auth() middleware?');
  return ctx;
}