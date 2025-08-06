import { createRoute } from '@hono/zod-openapi';
import {
  LoginErrorSchema,
  CallbackQuerySchema,
  CallbackSuccessSchema,
  CallbackErrorSchema,
  LogoutHeadersSchema,
  LogoutSuccessSchema,
  LogoutErrorSchema,
  MeSuccessSchema,
  MeErrorSchema,
  RefreshTokenRequestSchema,
  RefreshTokenSuccessSchema,
  RefreshTokenErrorSchema
} from './types';

/**
 * OpenAPI route definition for login endpoint
 */
export const loginRoute = createRoute({
  method: 'get',
  path: '/api/v1/auth/login',
  tags: ['Authentication'],
  summary: 'OAuth Login Initialization',
  description: 'Redirect to Auth0 login page for user authentication. Sets CSRF state cookie.',
  responses: {
    302: {
      description: 'Redirect to Auth0 authentication URL',
      headers: {
        Location: {
          schema: {
            type: 'string',
            example: 'https://auth.example.com/authorize?client_id=...'
          }
        },
        'Set-Cookie': {
          schema: {
            type: 'string',
            example: 'auth_state=uuid; HttpOnly; SameSite=Lax; Max-Age=600'
          }
        }
      }
    },
    400: {
      content: {
        'application/json': {
          schema: LoginErrorSchema
        }
      },
      description: 'Unauthorized redirect base URL'
    },
    500: {
      content: {
        'application/json': {
          schema: LoginErrorSchema
        }
      },
      description: 'Authentication service not configured or unavailable'
    }
  }
});

/**
 * OpenAPI route definition for OAuth callback
 */
export const callbackRoute = createRoute({
  method: 'get',
  path: '/api/v1/auth/callback',
  tags: ['Authentication'],
  summary: 'OAuth Callback Handler',
  description: 'Handle OAuth callback from Auth0, exchange code for tokens and create user session',
  request: {
    query: CallbackQuerySchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CallbackSuccessSchema
        }
      },
      description: 'Authentication successful'
    },
    400: {
      content: {
        'application/json': {
          schema: CallbackErrorSchema
        }
      },
      description: 'Bad request - missing parameters, invalid state, or Auth0 error'
    },
    500: {
      content: {
        'application/json': {
          schema: CallbackErrorSchema
        }
      },
      description: 'Authentication processing failed'
    }
  }
});

/**
 * OpenAPI route definition for logout
 */
export const logoutRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/logout',
  tags: ['Authentication'],
  summary: 'End User Session',
  description: 'Destroy session and logout current user. Requires CSRF protection headers.',
  request: {
    headers: LogoutHeadersSchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: LogoutSuccessSchema
        }
      },
      description: 'Logout successful'
    },
    400: {
      content: {
        'application/json': {
          schema: LogoutErrorSchema
        }
      },
      description: 'Invalid request headers or origin'
    },
    401: {
      content: {
        'application/json': {
          schema: LogoutErrorSchema
        }
      },
      description: 'No active session found'
    },
    500: {
      content: {
        'application/json': {
          schema: LogoutErrorSchema
        }
      },
      description: 'Logout processing failed'
    }
  }
});

/**
 * OpenAPI route definition for current user endpoint
 */
export const meRoute = createRoute({
  method: 'get',
  path: '/api/v1/auth/me',
  tags: ['Authentication'],
  summary: 'Get Current User',
  description: 'Return information about the currently authenticated user based on session cookie',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MeSuccessSchema
        }
      },
      description: 'User information retrieved successfully'
    },
    401: {
      content: {
        'application/json': {
          schema: MeErrorSchema
        }
      },
      description: 'Authentication required or session expired'
    },
    500: {
      content: {
        'application/json': {
          schema: MeErrorSchema
        }
      },
      description: 'Failed to retrieve user information'
    }
  }
});

/**
 * OpenAPI route definition for refresh token endpoint
 */
export const refreshRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/refresh',
  tags: ['Authentication'],
  summary: 'Refresh Access Token',
  description: 'Refresh access token using HTTP-only refresh token with CSRF protection and token rotation',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RefreshTokenRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: RefreshTokenSuccessSchema
        }
      },
      description: 'Token refresh successful',
      headers: {
        'X-CSRF-Token': {
          schema: {
            type: 'string',
            description: 'New CSRF token for continued protection'
          }
        },
        'Set-Cookie': {
          schema: {
            type: 'string',
            description: 'Updated HTTP-only cookies with new refresh token'
          }
        }
      }
    },
    401: {
      content: {
        'application/json': {
          schema: RefreshTokenErrorSchema
        }
      },
      description: 'Unauthorized - invalid or expired refresh token'
    },
    403: {
      content: {
        'application/json': {
          schema: RefreshTokenErrorSchema
        }
      },
      description: 'Forbidden - CSRF validation failed or token reuse detected'
    },
    429: {
      content: {
        'application/json': {
          schema: RefreshTokenErrorSchema
        }
      },
      description: 'Too many requests - rate limit exceeded'
    },
    500: {
      content: {
        'application/json': {
          schema: RefreshTokenErrorSchema
        }
      },
      description: 'Internal server error - token refresh failed'
    }
  }
});