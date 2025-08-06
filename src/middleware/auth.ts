import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env } from '../types/env';
import { SessionService } from '../services/session';
import { Auth0Service } from '../services/auth0';
import type { SessionValidationResult } from '../types/session';

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
          // For now, master key functionality is disabled as MASTER_KEY is not configured
          const configuredMasterKey = undefined;
          if (configuredMasterKey && masterKey === configuredMasterKey) {
            authContext.isAuthenticated = true;
            authContext.isMasterKey = true;
            return await next();
          }
          // Invalid master key - continue to other auth methods
        }
      }

      // 2. Check JWT Bearer token authentication with auto-refresh
      const authHeader = c.req.header('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        try {
          const auth0Service = new Auth0Service(c.env);
          const payload = await auth0Service.verifyToken(token);
          
          // Set authentication context from JWT payload
          authContext.isAuthenticated = true;
          authContext.userId = payload.sub;
          authContext.roles = payload.roles || [];
          
          return await next();
        } catch (error) {
          // Check if token is expired and attempt auto-refresh
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('expired')) {
            // Attempt to refresh token using session-stored refresh token
            const sessionId = getCookie(c, 'session');
            if (sessionId) {
              try {
                const refreshResult = await attemptTokenRefresh(c, sessionId);
                if (refreshResult.success && refreshResult.newAccessToken) {
                  // Set new token in response header for client to update
                  c.res.headers.set('X-New-Access-Token', refreshResult.newAccessToken);
                  
                  // Verify the new token
                  const auth0 = new Auth0Service(c.env);
                  const newPayload = await auth0.verifyToken(refreshResult.newAccessToken);
                  
                  authContext.isAuthenticated = true;
                  authContext.userId = newPayload.sub;
                  authContext.roles = newPayload.roles || [];
                  
                  return await next();
                }
              } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                // Fall through to normal error handling
              }
            }
          }
          
          // JWT verification failed - do NOT fall back to session auth for security
          console.error('JWT verification failed:', error);
          return c.json({
            success: false,
            error: 'unauthorized',
            message: 'Invalid JWT token'
          }, 401);
        }
      }

      // 3. Check session cookie authentication
      const sessionId = getCookie(c, 'session');
      if (sessionId) {
        const validationResult = await SessionService.validateSession(sessionId);
        if (validationResult.valid) {
          authContext.isAuthenticated = true;
          authContext.sessionId = sessionId;
          authContext.userId = validationResult.user_data?.auth0_user_id;
          
          // Pre-fetch user roles for this request
          // TODO: Implement with ACLService.getUserRoles(userId, context)
          authContext.roles = [];
        }
      }

      // 4. Check if authentication is required
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

/**
 * Helper function to attempt token refresh
 */
async function attemptTokenRefresh(c: Context, sessionId: string): Promise<{
  success: boolean;
  newAccessToken?: string;
  newRefreshToken?: string;
  error?: string;
}> {
  try {
    // Get client information for security logging
    const ipAddress = c.req.header('CF-Connecting-IP') || 
                     c.req.header('X-Forwarded-For') || 
                     c.req.header('X-Real-IP');
    const userAgent = c.req.header('User-Agent');

    // Get session data to find associated refresh token
    const sessionValidation = await SessionService.validateSession(sessionId);
    if (!sessionValidation.valid || !sessionValidation.user_data) {
      return {
        success: false,
        error: 'Invalid session'
      };
    }

    // For security, we need to get the refresh token from our secure storage
    // rather than from the session cookie or client
    const refreshTokenId = getCookie(c, 'refresh_token_id');
    if (!refreshTokenId) {
      return {
        success: false,
        error: 'No refresh token available'
      };
    }

    // Validate and use the refresh token
    const tokenValidation = await SessionService.validateRefreshToken(
      refreshTokenId,
      ipAddress,
      userAgent
    );

    if (!tokenValidation.valid || !tokenValidation.token_data) {
      return {
        success: false,
        error: 'Invalid or expired refresh token'
      };
    }

    // Use Auth0Service to refresh the access token
    const auth0Service = new Auth0Service(c.env);
    const newTokens = await auth0Service.refreshAccessToken(tokenValidation.token_data.refresh_token);

    // Store the new refresh token if provided (token rotation)
    if (newTokens.refreshToken) {
      await SessionService.storeRefreshToken(
        sessionValidation.user_data.auth0_user_id,
        newTokens.refreshToken,
        ipAddress,
        userAgent
      );
    }

    return {
      success: true,
      newAccessToken: newTokens.accessToken,
      newRefreshToken: newTokens.refreshToken
    };

  } catch (error) {
    console.error('Token refresh attempt failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed'
    };
  }
}