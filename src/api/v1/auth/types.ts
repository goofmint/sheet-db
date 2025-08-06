import { z } from '@hono/zod-openapi';

// Login response schema (for documentation)
export const LoginRedirectSchema = z.object({
  message: z.string().openapi({
    example: 'Redirecting to Auth0 login',
    description: 'Information message'
  })
});

// Login error schema
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

// Callback query parameters schema
export const CallbackQuerySchema = z.object({
  code: z.string().openapi({
    param: {
      name: 'code',
      in: 'query'
    },
    example: 'abc123xyz',
    description: 'Authorization code from Auth0'
  }),
  state: z.string().openapi({
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

// Callback success response schema
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

// Callback error response schema
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

// Logout request headers schema
export const LogoutHeadersSchema = z.object({
  'X-Requested-With': z.literal('XMLHttpRequest').openapi({
    param: {
      name: 'X-Requested-With',
      in: 'header'
    },
    description: 'CSRF protection header'
  }),
  Origin: z.string().url().optional().openapi({
    param: { name: 'Origin', in: 'header' },
    description: 'Origin header used for CSRF/origin validation'
  }),
  Referer: z.string().url().optional().openapi({
    param: { name: 'Referer', in: 'header' },
    description: 'Referer header used for CSRF/origin validation'
  })
}).refine(h => h.Origin || h.Referer, {
  message: 'Either Origin or Referer header is required'
});

// Logout success response schema
export const LogoutSuccessSchema = z.object({
  success: z.literal(true).openapi({
    description: 'Success indicator'
  }),
  message: z.string().openapi({
    example: 'Successfully logged out',
    description: 'Success message'
  })
});

// Logout error response schema
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

// Me success response schema
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
      description: 'User last updated timestamp'
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

// Me error response schema
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

/**
 * Refresh token request schema
 */
export const RefreshTokenRequestSchema = z.object({
  csrf_token: z.string().optional().openapi({
    description: 'CSRF protection token',
    example: 'uuid-csrf-token'
  })
});

/**
 * Refresh token success response schema
 */
export const RefreshTokenSuccessSchema = z.object({
  success: z.literal(true),
  access_token: z.string().openapi({
    description: 'New access token',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
  }),
  expires_in: z.number().openapi({
    description: 'Token expiry time in seconds',
    example: 3600
  }),
  token_type: z.literal('Bearer').openapi({
    description: 'Token type',
    example: 'Bearer'
  })
});

/**
 * Refresh token error response schema
 */
export const RefreshTokenErrorSchema = z.object({
  success: z.literal(false),
  error: z.enum([
    'unauthorized',
    'forbidden', 
    'security_violation',
    'internal_server_error'
  ]).openapi({
    description: 'Error type',
    example: 'unauthorized'
  }),
  message: z.string().openapi({
    description: 'Human readable error message',
    example: 'No refresh token provided'
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
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;
export type RefreshTokenSuccessResponse = z.infer<typeof RefreshTokenSuccessSchema>;
export type RefreshTokenErrorResponse = z.infer<typeof RefreshTokenErrorSchema>;