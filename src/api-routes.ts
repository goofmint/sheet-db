import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import {
  CreateRoleRequestSchema,
  CreateRoleResponseSchema,
  UpdateRoleRequestSchema,
  UpdateRoleResponseSchema,
  DeleteRoleResponseSchema,
  RoleNameParamSchema,
  UnauthorizedErrorSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
  ConflictErrorSchema,
  ValidationErrorSchema,
  ServerErrorSchema,
  AuthStartRequestSchema,
  AuthStartResponseSchema,
  AuthCallbackRequestSchema,
  AuthCallbackResponseSchema,
  AuthCallbackQuerySchema,
  AuthErrorResponseSchema,
  GetUserMeResponseSchema,
  UpdateUserRequestSchema,
  UpdateUserResponseSchema,
  UserIdParamSchema,
  DeleteUserResponseSchema,
  CreateSheetRequestSchema,
  CreateSheetResponseSchema
} from './api-schemas';

// POST /api/roles - Create a new role
export const createRoleRoute = createRoute({
  method: 'post',
  path: '/api/roles',
  summary: 'Create a new role',
  description: 'Creates a new role with the specified name and permissions. Role names must be unique.',
  tags: ['Roles'],
  security: [{ BearerAuth: [] }],
  request: {
    headers: z.object({
      authorization: z.string().regex(/^Bearer .+/, "Must be in format 'Bearer <token>'")
    }),
    body: {
      content: {
        'application/json': {
          schema: CreateRoleRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CreateRoleResponseSchema,
        },
      },
      description: 'Role created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ValidationErrorSchema,
        },
      },
      description: 'Invalid request data',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedErrorSchema,
        },
      },
      description: 'Authentication failed',
    },
    409: {
      content: {
        'application/json': {
          schema: ConflictErrorSchema,
        },
      },
      description: 'Role name already exists',
    },
    500: {
      content: {
        'application/json': {
          schema: ServerErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

// PUT /api/roles/:roleName - Update a role
export const updateRoleRoute = createRoute({
  method: 'put',
  path: '/api/roles/{roleName}',
  summary: 'Update a role',
  description: 'Updates an existing role. Requires write permission on the role.',
  tags: ['Roles'],
  security: [{ BearerAuth: [] }],
  request: {
    headers: z.object({
      authorization: z.string().regex(/^Bearer .+/, "Must be in format 'Bearer <token>'")
    }),
    params: RoleNameParamSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateRoleRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UpdateRoleResponseSchema,
        },
      },
      description: 'Role updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ValidationErrorSchema,
        },
      },
      description: 'Invalid request data',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedErrorSchema,
        },
      },
      description: 'Authentication failed',
    },
    403: {
      content: {
        'application/json': {
          schema: ForbiddenErrorSchema,
        },
      },
      description: 'Permission denied - no write access to this role',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundErrorSchema,
        },
      },
      description: 'Role not found',
    },
    409: {
      content: {
        'application/json': {
          schema: ConflictErrorSchema,
        },
      },
      description: 'Role name already exists (when renaming)',
    },
    500: {
      content: {
        'application/json': {
          schema: ServerErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

// DELETE /api/roles/:roleName - Delete a role
export const deleteRoleRoute = createRoute({
  method: 'delete',
  path: '/api/roles/{roleName}',
  summary: 'Delete a role',
  description: 'Deletes an existing role. Requires write permission on the role.',
  tags: ['Roles'],
  security: [{ BearerAuth: [] }],
  request: {
    headers: z.object({
      authorization: z.string().regex(/^Bearer .+/, "Must be in format 'Bearer <token>'")
    }),
    params: RoleNameParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DeleteRoleResponseSchema,
        },
      },
      description: 'Role deleted successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedErrorSchema,
        },
      },
      description: 'Authentication failed',
    },
    403: {
      content: {
        'application/json': {
          schema: ForbiddenErrorSchema,
        },
      },
      description: 'Permission denied - no write access to this role',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundErrorSchema,
        },
      },
      description: 'Role not found',
    },
    500: {
      content: {
        'application/json': {
          schema: ServerErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

// GET /api/auth - Start authentication or handle callback
export const authStartRoute = createRoute({
  method: 'get',
  path: '/api/auth',
  summary: 'Start authentication or handle Auth0 callback',
  description: 'Initiates Auth0 authentication flow or processes callback with authorization code',
  tags: ['Authentication'],
  request: {
    query: AuthStartRequestSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AuthStartResponseSchema,
        },
      },
      description: 'Authentication URL generated successfully',
    },
    302: {
      description: 'Redirect to Auth0 authorization URL',
    },
    400: {
      content: {
        'application/json': {
          schema: AuthErrorResponseSchema,
        },
      },
      description: 'Authentication error or invalid parameters',
    },
    500: {
      content: {
        'application/json': {
          schema: ServerErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

// GET /api/auth/callback - Auth0 callback redirect handler
export const authCallbackGetRoute = createRoute({
  method: 'get',
  path: '/api/auth/callback',
  summary: 'Auth0 callback redirect handler',
  description: 'Handles Auth0 callback and redirects to main auth endpoint with parameters',
  tags: ['Authentication'],
  request: {
    query: AuthCallbackQuerySchema,
  },
  responses: {
    302: {
      description: 'Redirects to /api/auth with callback parameters',
    },
    400: {
      description: 'Redirect to /api/auth with error parameter',
    },
  },
});

// POST /api/auth/callback - Process authentication callback
export const authCallbackPostRoute = createRoute({
  method: 'post',
  path: '/api/auth/callback',
  summary: 'Process Auth0 authentication callback',
  description: 'Exchanges authorization code for access token and creates user session',
  tags: ['Authentication'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: AuthCallbackRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AuthCallbackResponseSchema,
        },
      },
      description: 'Authentication successful, session created',
    },
    400: {
      content: {
        'application/json': {
          schema: AuthErrorResponseSchema,
        },
      },
      description: 'Invalid authorization code or authentication failure',
    },
    500: {
      content: {
        'application/json': {
          schema: ServerErrorSchema,
        },
      },
      description: 'Internal server error during authentication',
    },
  },
});

// GET /api/users/me - Get current authenticated user information
export const getUserMeRoute = createRoute({
  method: 'get',
  path: '/api/users/me',
  summary: 'Get current user information',
  description: 'Returns the authenticated user\'s information from the _User sheet',
  tags: ['Users'],
  security: [{ BearerAuth: [] }],
  request: {
    headers: z.object({
      authorization: z.string().regex(/^Bearer .+/, "Must be in format 'Bearer <token>'")
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetUserMeResponseSchema,
        },
      },
      description: 'User information retrieved successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedErrorSchema,
        },
      },
      description: 'Authentication failed - user not authenticated',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundErrorSchema,
        },
      },
      description: 'User not found in _User sheet',
    },
    500: {
      content: {
        'application/json': {
          schema: ServerErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

// PUT /api/users/:id - Update user information
export const updateUserRoute = createRoute({
  method: 'put',
  path: '/api/users/{id}',
  summary: 'Update user information',
  description: 'Updates user information in the _User sheet. Requires write permission on the user.',
  tags: ['Users'],
  security: [{ BearerAuth: [] }],
  request: {
    headers: z.object({
      authorization: z.string().regex(/^Bearer .+/, "Must be in format 'Bearer <token>'")
    }),
    params: UserIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateUserRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UpdateUserResponseSchema,
        },
      },
      description: 'User updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ValidationErrorSchema,
        },
      },
      description: 'Invalid request data or schema validation failed',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedErrorSchema,
        },
      },
      description: 'Authentication failed',
    },
    403: {
      content: {
        'application/json': {
          schema: ForbiddenErrorSchema,
        },
      },
      description: 'Permission denied - no write access to this user',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundErrorSchema,
        },
      },
      description: 'User not found',
    },
    500: {
      content: {
        'application/json': {
          schema: ServerErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});


// DELETE /api/users/:id - Delete user information
export const deleteUserRoute = createRoute({
  method: 'delete',
  path: '/api/users/{id}',
  summary: 'Delete user information',
  description: 'Deletes user information from the _User sheet. Requires write permission on the user. Data is cleared rather than deleted to prevent row shifting conflicts.',
  tags: ['Users'],
  security: [{ BearerAuth: [] }],
  request: {
    headers: z.object({
      authorization: z.string().regex(/^Bearer .+/, "Must be in format 'Bearer <token>'")
    }),
    params: UserIdParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DeleteUserResponseSchema,
        },
      },
      description: 'User deleted successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedErrorSchema,
        },
      },
      description: 'Authentication failed',
    },
    403: {
      content: {
        'application/json': {
          schema: ForbiddenErrorSchema,
        },
      },
      description: 'Permission denied - no write access to this user',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundErrorSchema,
        },
      },
      description: 'User not found',
    },
    500: {
      content: {
        'application/json': {
          schema: ServerErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});


// POST /api/sheets - Create a new sheet
export const createSheetRoute = createRoute({
  method: 'post',
  path: '/api/sheets',
  summary: 'Create a new sheet',
  description: 'Creates a new sheet in the spreadsheet with specified columns and types. Requires CREATE_SHEET_BY_API permission and user/role authorization.',
  tags: ['Sheets'],
  security: [{ BearerAuth: [] }],
  request: {
    headers: z.object({
      authorization: z.string().regex(/^Bearer .+/, "Must be in format 'Bearer <token>'")
    }),
    body: {
      content: {
        'application/json': {
          schema: CreateSheetRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CreateSheetResponseSchema,
        },
      },
      description: 'Sheet created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ValidationErrorSchema,
        },
      },
      description: 'Invalid request data or reserved column names used',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedErrorSchema,
        },
      },
      description: 'Authentication failed',
    },
    403: {
      content: {
        'application/json': {
          schema: ForbiddenErrorSchema,
        },
      },
      description: 'Permission denied - sheet creation not allowed for this user/role',
    },
    500: {
      content: {
        'application/json': {
          schema: ServerErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});
