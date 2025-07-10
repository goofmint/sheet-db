import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import {
  CreateRoleRequestSchema,
  CreateRoleResponseSchema,
  UpdateRoleRequestSchema,
  UpdateRoleResponseSchema,
  DeleteRoleResponseSchema,
  GetRolesResponseSchema,
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
  CreateSheetResponseSchema,
  UpdateSheetRequestSchema,
  UpdateSheetResponseSchema,
  SheetIdParamSchema,
  DeleteSheetResponseSchema,
  GetSheetsResponseSchema,
  GetSheetMetadataResponseSchema,
  AddColumnsRequestSchema,
  AddColumnsResponseSchema,
  ColumnIdParamSchema,
  DeleteColumnResponseSchema,
  UpdateColumnRequestSchema,
  UpdateColumnResponseSchema,
  GetColumnInfoResponseSchema,
  GetSheetDataQuerySchema,
  GetSheetDataResponseSchema
} from './api-schemas';

// GET /api/roles - Get list of roles
export const getRolesRoute = createRoute({
  method: 'get',
  path: '/api/roles',
  summary: 'Get list of roles',
  description: 'Returns a list of roles. If authenticated, returns roles the user can read (public_read=true, user_read contains user ID, or role_read contains user\'s roles). If not authenticated, returns only public_read=true roles.',
  tags: ['Roles'],
  request: {},
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetRolesResponseSchema,
        },
      },
      description: 'Role list retrieved successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedErrorSchema,
        },
      },
      description: 'Authentication failed',
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

// GET /api/sheets - Get list of sheets
export const getSheetsRoute = createRoute({
  method: 'get',
  path: '/api/sheets',
  summary: 'Get list of sheets',
  description: 'Returns a list of all sheets in the spreadsheet with their IDs and names',
  tags: ['Sheets'],
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
          schema: GetSheetsResponseSchema,
        },
      },
      description: 'Sheet list retrieved successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedErrorSchema,
        },
      },
      description: 'Authentication failed',
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
  description: 'Creates a new sheet in the spreadsheet with default columns and permission settings. Requires CREATE_SHEET_BY_API permission and user/role authorization.',
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

// PUT /api/sheets/:id - Update an existing sheet
export const updateSheetRoute = createRoute({
  method: 'put',
  path: '/api/sheets/{id}',
  summary: 'Update an existing sheet',
  description: 'Updates an existing sheet name and permission settings. Requires write access to the sheet (public_write=true, user in role_write, or user in user_write).',
  tags: ['Sheets'],
  security: [{ BearerAuth: [] }],
  request: {
    headers: z.object({
      authorization: z.string().regex(/^Bearer .+/, "Must be in format 'Bearer <token>'")
    }),
    params: SheetIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateSheetRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UpdateSheetResponseSchema,
        },
      },
      description: 'Sheet updated successfully',
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
      description: 'Permission denied - no write access to this sheet',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundErrorSchema,
        },
      },
      description: 'Sheet not found',
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

// DELETE /api/sheets/:id - Delete a sheet
export const deleteSheetRoute = createRoute({
  method: 'delete',
  path: '/api/sheets/{id}',
  summary: 'Delete a sheet',
  description: 'Deletes an existing sheet from the spreadsheet. Requires write access to the sheet (public_write=true, user\'s role in role_write, or user ID in user_write).',
  tags: ['Sheets'],
  security: [{ BearerAuth: [] }],
  request: {
    headers: z.object({
      authorization: z.string().regex(/^Bearer .+/, "Must be in format 'Bearer <token>'")
    }),
    params: SheetIdParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DeleteSheetResponseSchema,
        },
      },
      description: 'Sheet deleted successfully',
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
      description: 'Permission denied - no write access to this sheet',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundErrorSchema,
        },
      },
      description: 'Sheet not found',
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

// GET /api/sheets/:id - Get sheet metadata
export const getSheetMetadataRoute = createRoute({
  method: 'get',
  path: '/api/sheets/{id}',
  summary: 'Get sheet metadata',
  description: 'Returns sheet metadata including column definitions from row 2. Accepts either numeric sheet ID or sheet name. If authenticated, checks read permissions. If not authenticated, only returns data for public_read=true sheets.',
  tags: ['Sheets'],
  request: {
    params: SheetIdParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetSheetMetadataResponseSchema,
        },
      },
      description: 'Sheet metadata retrieved successfully',
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
      description: 'Permission denied - no read access to this sheet',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundErrorSchema,
        },
      },
      description: 'Sheet not found',
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

// POST /api/sheets/:id/columns - Add columns to a sheet
export const addColumnsRoute = createRoute({
  method: 'post',
  path: '/api/sheets/{id}/columns',
  summary: 'Add columns to a sheet',
  description: 'Adds new columns to an existing sheet with specified types and validation rules. Requires write access to the sheet.',
  tags: ['Columns'],
  security: [{ BearerAuth: [] }],
  request: {
    headers: z.object({
      authorization: z.string().regex(/^Bearer .+/, "Must be in format 'Bearer <token>'")
    }),
    params: SheetIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: AddColumnsRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AddColumnsResponseSchema,
        },
      },
      description: 'Columns added successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ValidationErrorSchema,
        },
      },
      description: 'Invalid request data or column already exists',
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
      description: 'Permission denied - no write access to this sheet',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundErrorSchema,
        },
      },
      description: 'Sheet not found',
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

// DELETE /api/sheets/:id/columns/:columnId - Delete a column from a sheet
export const deleteColumnRoute = createRoute({
  method: 'delete',
  path: '/api/sheets/{id}/columns/{columnId}',
  summary: 'Delete a column from a sheet',
  description: 'Deletes a column from an existing sheet. If data misalignment risk exists during concurrent operations, the column data will be cleared instead of deleted. Requires column modification permission (MODIFY_COLUMNS_BY_API=true and user in MODIFY_SHEET_USER or MODIFY_SHEET_ROLE).',
  tags: ['Columns'],
  security: [{ BearerAuth: [] }],
  request: {
    headers: z.object({
      authorization: z.string().regex(/^Bearer .+/, "Must be in format 'Bearer <token>'")
    }),
    params: z.object({
      id: z.string().min(1, "Sheet ID is required"),
      columnId: z.string().min(1, "Column ID is required")
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DeleteColumnResponseSchema,
        },
      },
      description: 'Column deleted or cleared successfully',
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
      description: 'Permission denied - column modification not allowed',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundErrorSchema,
        },
      },
      description: 'Sheet or column not found',
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

// PUT /api/sheets/:id/columns/:columnId - Update a column in a sheet
export const updateColumnRoute = createRoute({
  method: 'put',
  path: '/api/sheets/{id}/columns/{columnId}',
  summary: 'Update a column in a sheet',
  description: 'Updates a column in an existing sheet. Type modification is not allowed. Requires column modification permission (MODIFY_COLUMNS_BY_API=true and user in MODIFY_SHEET_USER or MODIFY_SHEET_ROLE).',
  tags: ['Columns'],
  security: [{ BearerAuth: [] }],
  request: {
    headers: z.object({
      authorization: z.string().regex(/^Bearer .+/, "Must be in format 'Bearer <token>'")
    }),
    params: z.object({
      id: z.string().min(1, "Sheet ID is required"),
      columnId: z.string().min(1, "Column ID is required")
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateColumnRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UpdateColumnResponseSchema,
        },
      },
      description: 'Column updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ValidationErrorSchema,
        },
      },
      description: 'Invalid request data or type modification attempted',
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
      description: 'Permission denied - column modification not allowed',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundErrorSchema,
        },
      },
      description: 'Sheet or column not found',
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

// GET /api/sheets/:id/columns/:columnId - Get column schema information
export const getColumnInfoRoute = createRoute({
  method: 'get',
  path: '/api/sheets/{id}/columns/{columnId}',
  summary: 'Get column schema information',
  description: 'Returns detailed schema information for a specific column in a sheet, including type, validation rules, and constraints. No authentication required.',
  tags: ['Columns'],
  request: {
    params: z.object({
      id: z.string().min(1, "Sheet ID is required"),
      columnId: z.string().min(1, "Column ID is required")
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetColumnInfoResponseSchema,
        },
      },
      description: 'Column schema information retrieved successfully',
    },
    403: {
      content: {
        'application/json': {
          schema: ForbiddenErrorSchema,
        },
      },
      description: 'Permission denied - no read access to this sheet',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundErrorSchema,
        },
      },
      description: 'Sheet or column not found',
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

// GET /api/sheets/:id/data - Get sheet data with query support
export const getSheetDataRoute = createRoute({
  method: 'get',
  path: '/api/sheets/{id}/data',
  summary: 'Get sheet data with query support',
  description: 'Returns sheet data with advanced query capabilities including filtering, pagination, ordering, and counting. Supports complex WHERE conditions with operators like $lt, $lte, $gt, $gte, $ne, $in, $nin, $exists, $regex, and $text. Authentication is optional - unauthenticated users can only access sheets with public_read=true.',
  tags: ['Data'],
  request: {
    params: SheetIdParamSchema,
    query: GetSheetDataQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GetSheetDataResponseSchema,
        },
      },
      description: 'Sheet data retrieved successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedErrorSchema,
        },
      },
      description: 'Authentication required for this sheet',
    },
    403: {
      content: {
        'application/json': {
          schema: ForbiddenErrorSchema,
        },
      },
      description: 'Permission denied - no read access to this sheet',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundErrorSchema,
        },
      },
      description: 'Sheet not found',
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