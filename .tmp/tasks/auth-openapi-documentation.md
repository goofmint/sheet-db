# Auth OpenAPI Documentation Task

## Overview
Create comprehensive OpenAPI documentation for `/api/v1/auth` endpoints using `@hono/zod-openapi`.

## Scope
- **Documentation Only**: This task focuses solely on creating OpenAPI documentation
- **Implementation Prohibited**: Do not implement the actual OpenAPI integration
- **Endpoints Covered**: 
  - GET /api/v1/auth/login
  - GET /api/v1/auth/callback
  - POST /api/v1/auth/logout
  - GET /api/v1/auth/me

## Analysis of Existing Endpoints

### GET /api/v1/auth/login - Initialize OAuth Login
**Purpose**: Redirects to Auth0 login page for user authentication

**Request**: No body required

**Responses**:
- 302: Redirect to Auth0 authorization URL with state parameter
- 400: Unauthorized redirect base URL
- 500: Authentication service not configured or unavailable

**Security**:
- Validates redirect URI against allowed bases
- Generates CSRF state token
- Sets HTTP-only cookie for state validation

### GET /api/v1/auth/callback - OAuth Callback Handler
**Purpose**: Handles OAuth callback from Auth0, exchanges code for tokens, creates session

**Request**:
- Query Parameters:
  - `code`: Authorization code from Auth0
  - `state`: CSRF protection state
  - `error` (optional): Auth0 error code
  - `error_description` (optional): Auth0 error details

**Responses**:
- 200: Authentication successful with user data and session
- 400: Missing parameters, invalid state, or Auth0 error
- 500: Authentication process failed

**Security**:
- Validates state parameter against cookie
- Creates secure session with HTTP-only cookie
- Updates user data in _User sheet

### POST /api/v1/auth/logout - End User Session
**Purpose**: Logs out the current user by destroying their session

**Request**:
- Headers:
  - `X-Requested-With: XMLHttpRequest` (CSRF protection)
  - `Origin` or `Referer` header required

**Responses**:
- 200: Successfully logged out
- 400: Invalid request headers or origin
- 401: No active session found
- 500: Logout process failed

**Security**:
- CSRF protection via custom header
- Origin validation
- Timing attack mitigation

### GET /api/v1/auth/me - Get Current User
**Purpose**: Returns information about the currently authenticated user

**Request**: No body required (uses session cookie)

**Responses**:
- 200: User information with session details
- 401: Authentication required or session expired
- 500: Failed to retrieve user information

**Security**:
- Session validation
- Expiration checking
- Timing attack mitigation

## Task Deliverables

### 1. Type Definitions (`src/api/v1/auth/types.ts`)

```typescript
import { z } from '@hono/zod-openapi';

// Login Response Schema (for documentation purposes)
export const LoginRedirectSchema = z.object({
  message: z.string().openapi({
    example: 'Redirecting to Auth0 login',
    description: 'Informational message'
  })
});

// Login Error Schema
export const LoginErrorSchema = z.object({
  error: z.string().openapi({
    example: 'Unauthorized redirect base URL',
    description: 'Error type identifier'
  }),
  message: z.string().openapi({
    example: 'Host https://example.com is not in allowed redirect bases',
    description: 'Detailed error message'
  })
});

// Callback Query Parameters Schema
export const CallbackQuerySchema = z.object({
  code: z.string().optional().openapi({
    param: {
      name: 'code',
      in: 'query'
    },
    example: 'abc123xyz',
    description: 'Authorization code from Auth0'
  }),
  state: z.string().optional().openapi({
    param: {
      name: 'state',
      in: 'query'
    },
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'CSRF protection state parameter'
  }),
  error: z.string().optional().openapi({
    param: {
      name: 'error',
      in: 'query'
    },
    example: 'access_denied',
    description: 'Auth0 error code'
  }),
  error_description: z.string().optional().openapi({
    param: {
      name: 'error_description',
      in: 'query'
    },
    example: 'User cancelled the login flow',
    description: 'Human-readable error description'
  })
});

// Callback Success Response Schema
export const CallbackSuccessSchema = z.object({
  success: z.literal(true).openapi({
    description: 'Success indicator'
  }),
  user: z.object({
    id: z.string().openapi({
      example: 'auth0|507f1f77bcf86cd799439011',
      description: 'Unique user identifier from Auth0'
    }),
    email: z.string().email().openapi({
      example: 'user@example.com',
      description: 'User email address'
    }),
    name: z.string().nullable().openapi({
      example: 'John Doe',
      description: 'User display name'
    }),
    picture: z.string().url().nullable().openapi({
      example: 'https://avatars.example.com/user.jpg',
      description: 'User profile picture URL'
    }),
    created_at: z.string().openapi({
      example: '2024-01-01T00:00:00.000Z',
      description: 'User creation timestamp'
    }),
    last_login: z.string().openapi({
      example: '2024-01-15T12:00:00.000Z',
      description: 'Last login timestamp'
    })
  }).openapi({
    description: 'User information'
  }),
  session: z.object({
    session_id: z.string().openapi({
      example: 'sess_550e8400-e29b-41d4-a716-446655440000',
      description: 'Session identifier'
    }),
    expires_at: z.string().openapi({
      example: '2024-01-16T12:00:00.000Z',
      description: 'Session expiration timestamp'
    })
  }).openapi({
    description: 'Session information'
  }),
  authenticated: z.literal(true).openapi({
    description: 'Authentication status'
  })
});

// Callback Error Response Schema
export const CallbackErrorSchema = z.object({
  success: z.literal(false).openapi({
    description: 'Success indicator'
  }),
  error: z.string().openapi({
    example: 'invalid_state',
    description: 'Error code'
  }),
  message: z.string().openapi({
    example: 'Invalid state parameter',
    description: 'Error message'
  }),
  authenticated: z.literal(false).openapi({
    description: 'Authentication status'
  })
});

// Logout Request Headers Schema
export const LogoutHeadersSchema = z.object({
  'X-Requested-With': z.literal('XMLHttpRequest').openapi({
    param: {
      name: 'X-Requested-With',
      in: 'header'
    },
    description: 'CSRF protection header'
  })
});

// Logout Success Response Schema
export const LogoutSuccessSchema = z.object({
  success: z.literal(true).openapi({
    description: 'Success indicator'
  }),
  message: z.string().openapi({
    example: 'Successfully logged out',
    description: 'Success message'
  })
});

// Logout Error Response Schema
export const LogoutErrorSchema = z.object({
  success: z.literal(false).openapi({
    description: 'Success indicator'
  }),
  error: z.string().openapi({
    example: 'invalid_request',
    description: 'Error code'
  }),
  message: z.string().openapi({
    example: 'Invalid request headers',
    description: 'Error message'
  })
});

// Me Success Response Schema
export const MeSuccessSchema = z.object({
  success: z.literal(true).openapi({
    description: 'Success indicator'
  }),
  user: z.object({
    id: z.string().openapi({
      example: 'auth0|507f1f77bcf86cd799439011',
      description: 'User ID from Auth0 sub claim'
    }),
    name: z.string().nullable().openapi({
      example: 'John Doe',
      description: 'User display name'
    }),
    email: z.string().email().openapi({
      example: 'user@example.com',
      description: 'User email address'
    }),
    picture: z.string().url().nullable().openapi({
      example: 'https://avatars.example.com/user.jpg',
      description: 'User profile picture URL'
    }),
    email_verified: z.boolean().openapi({
      example: true,
      description: 'Email verification status'
    }),
    updated_at: z.string().openapi({
      example: '2024-01-15T10:00:00.000Z',
      description: 'User last update timestamp'
    }),
    iss: z.string().openapi({
      example: 'https://auth.example.com/',
      description: 'Token issuer'
    }),
    aud: z.string().openapi({
      example: 'abc123',
      description: 'Token audience'
    }),
    iat: z.number().openapi({
      example: 1704067200,
      description: 'Token issued at timestamp'
    }),
    exp: z.number().openapi({
      example: 1704153600,
      description: 'Token expiration timestamp'
    }),
    sub: z.string().openapi({
      example: 'auth0|507f1f77bcf86cd799439011',
      description: 'Subject (user ID)'
    }),
    sid: z.string().openapi({
      example: 'session123',
      description: 'Session ID from Auth0'
    })
  }).openapi({
    description: 'User information from session'
  }),
  session: z.object({
    session_id: z.string().openapi({
      example: 'sess_550e8400-e29b-41d4-a716-446655440000',
      description: 'Session identifier'
    }),
    expires_at: z.string().openapi({
      example: '2024-01-16T12:00:00.000Z',
      description: 'Session expiration timestamp'
    }),
    created_at: z.string().openapi({
      example: '2024-01-15T12:00:00.000Z',
      description: 'Session creation timestamp'
    })
  }).openapi({
    description: 'Session metadata'
  })
});

// Me Error Response Schema
export const MeErrorSchema = z.object({
  success: z.literal(false).openapi({
    description: 'Success indicator'
  }),
  error: z.string().openapi({
    example: 'unauthorized',
    description: 'Error code'
  }),
  message: z.string().openapi({
    example: 'Authentication required',
    description: 'Error message'
  })
});

// TypeScript types derived from schemas
export type LoginRedirectResponse = z.infer<typeof LoginRedirectSchema>;
export type LoginErrorResponse = z.infer<typeof LoginErrorSchema>;
export type CallbackQuery = z.infer<typeof CallbackQuerySchema>;
export type CallbackSuccessResponse = z.infer<typeof CallbackSuccessSchema>;
export type CallbackErrorResponse = z.infer<typeof CallbackErrorSchema>;
export type LogoutHeaders = z.infer<typeof LogoutHeadersSchema>;
export type LogoutSuccessResponse = z.infer<typeof LogoutSuccessSchema>;
export type LogoutErrorResponse = z.infer<typeof LogoutErrorSchema>;
export type MeSuccessResponse = z.infer<typeof MeSuccessSchema>;
export type MeErrorResponse = z.infer<typeof MeErrorSchema>;
```

### 2. OpenAPI Route Definitions (`src/api/v1/auth/route.ts`)

```typescript
import { createRoute } from '@hono/zod-openapi';
import {
  LoginRedirectSchema,
  LoginErrorSchema,
  CallbackQuerySchema,
  CallbackSuccessSchema,
  CallbackErrorSchema,
  LogoutHeadersSchema,
  LogoutSuccessSchema,
  LogoutErrorSchema,
  MeSuccessSchema,
  MeErrorSchema
} from './types';

/**
 * OpenAPI route definition for login endpoint
 */
export const loginRoute = createRoute({
  method: 'get',
  path: '/api/v1/auth/login',
  tags: ['Authentication'],
  summary: 'Initialize OAuth Login',
  description: 'Redirects to Auth0 login page for user authentication. Sets CSRF state cookie.',
  responses: {
    302: {
      description: 'Redirect to Auth0 authorization URL',
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
  description: 'Handles OAuth callback from Auth0, exchanges authorization code for tokens, and creates user session',
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
      description: 'Authentication process failed'
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
  description: 'Logs out the current user by destroying their session. Requires CSRF protection headers.',
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
      description: 'Successfully logged out'
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
      description: 'Logout process failed'
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
  description: 'Returns information about the currently authenticated user based on session cookie',
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

// Future route definitions
// export const refreshRoute = createRoute({ ... }); // Token refresh endpoint
// export const revokeRoute = createRoute({ ... }); // Token revocation endpoint
```

## Implementation Notes

### Authentication Flow
1. **Login**: User initiates login → Redirect to Auth0 → State cookie set
2. **Callback**: Auth0 redirects back → Validate state → Exchange code for tokens → Create session
3. **Session**: Session stored in D1 database with HTTP-only cookie
4. **Logout**: Validate CSRF headers → Delete session → Clear cookie

### Security Considerations
1. **CSRF Protection**: State parameter for OAuth flow, custom headers for logout
2. **Cookie Security**: HTTP-only, Secure (HTTPS), SameSite attributes
3. **Origin Validation**: Check Origin/Referer headers on sensitive operations
4. **Timing Attack Mitigation**: Consistent response times for auth operations
5. **Session Management**: Server-side sessions with expiration

### Error Handling
1. **OAuth Errors**: Properly handle Auth0 error responses
2. **Validation Errors**: Clear messages for missing/invalid parameters
3. **Service Errors**: Graceful degradation when Auth0 unavailable
4. **Session Errors**: Proper cleanup of expired sessions

### Data Storage
- **Sessions**: D1 database session table
- **User Data**: _User sheet in Google Sheets (via UserSheet service)
- **Cookies**: HTTP-only session_id and temporary auth_state

## Future Enhancements
- GET /api/v1/auth/refresh - Refresh access token using refresh token
- POST /api/v1/auth/revoke - Revoke refresh token
- GET /api/v1/auth/providers - List available authentication providers
- POST /api/v1/auth/link - Link additional auth providers to account

## Testing Requirements
When implementation is added:
1. Test OAuth flow with valid and invalid states
2. Test session creation and expiration
3. Test CSRF protection mechanisms
4. Test error handling for Auth0 failures
5. Test cookie security attributes
6. Test timing attack mitigation
7. Test concurrent session handling