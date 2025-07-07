import { z } from 'zod';

// 共通スキーマ
export const ErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.string()
});

export const BearerAuthSchema = z.object({
	Authorization: z.string().regex(/^Bearer .+/, "Authorization header must be in format 'Bearer <token>'")
});

// Role関連のスキーマ
export const RoleSchema = z.object({
	name: z.string().min(1, "Role name is required"),
	users: z.array(z.string()).default([]),
	roles: z.array(z.string()).default([]),
	created_at: z.string(),
	updated_at: z.string(),
	public_read: z.boolean().default(false),
	public_write: z.boolean().default(false),
	role_read: z.array(z.string()).default([]),
	role_write: z.array(z.string()).default([]),
	user_read: z.array(z.string()).default([]),
	user_write: z.array(z.string()).default([])
});

export const CreateRoleRequestSchema = z.object({
	name: z.string().min(1, "Role name is required"),
	public_read: z.boolean().optional(),
	public_write: z.boolean().optional()
});

export const CreateRoleResponseSchema = z.object({
	success: z.literal(true),
	data: RoleSchema
});

export const UpdateRoleRequestSchema = z.object({
	name: z.string().min(1, "Role name must be a non-empty string").optional(),
	public_read: z.boolean().optional(),
	public_write: z.boolean().optional(),
	role_read: z.array(z.string()).optional(),
	role_write: z.array(z.string()).optional(),
	user_read: z.array(z.string()).optional(),
	user_write: z.array(z.string()).optional(),
	users: z.array(z.string()).optional(),
	roles: z.array(z.string()).optional()
}).refine(data => Object.keys(data).length > 0, {
	message: "At least one field must be provided for update"
});

export const UpdateRoleResponseSchema = z.object({
	success: z.literal(true),
	data: RoleSchema
});

export const DeleteRoleResponseSchema = z.object({});

// パラメータスキーマ
export const RoleNameParamSchema = z.object({
	roleName: z.string().min(1, "Role name is required")
});

// エラーレスポンスの種類
export const UnauthorizedErrorSchema = z.object({
	success: z.literal(false),
	error: z.string().describe("Authentication failed or token invalid")
});

export const ForbiddenErrorSchema = z.object({
	success: z.literal(false),
	error: z.string().describe("Permission denied")
});

export const NotFoundErrorSchema = z.object({
	success: z.literal(false),
	error: z.string().describe("Role not found")
});

export const ConflictErrorSchema = z.object({
	success: z.literal(false),
	error: z.string().describe("Role name already exists")
});

export const ValidationErrorSchema = z.object({
	success: z.literal(false),
	error: z.string().describe("Invalid request data")
});

export const ServerErrorSchema = z.object({
	success: z.literal(false),
	error: z.string().describe("Internal server error")
});

// Authentication関連のスキーマ
export const AuthStartRequestSchema = z.object({
	code: z.string().optional().describe("Authorization code from Auth0 callback"),
	error: z.string().optional().describe("Error from Auth0 callback")
});

export const AuthStartResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		authUrl: z.string().describe("Auth0 authorization URL to redirect to"),
		redirectUri: z.string().describe("Callback URI for Auth0")
	})
});

export const AuthCallbackRequestSchema = z.object({
	code: z.string().min(1, "Authorization code is required")
});

export const AuthCallbackResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		sessionId: z.string().describe("Session ID for authenticated requests"),
		user: z.object({
			id: z.string(),
			email: z.string().email(),
			name: z.string().optional(),
			given_name: z.string().optional(),
			family_name: z.string().optional(),
			nickname: z.string().optional(),
			picture: z.string().optional(),
			email_verified: z.boolean().optional(),
			locale: z.string().optional()
		})
	})
});

export const AuthCallbackQuerySchema = z.object({
	code: z.string().optional().describe("Authorization code from Auth0"),
	error: z.string().optional().describe("Error from Auth0"),
	state: z.string().optional().describe("State parameter for CSRF protection")
});

export const AuthErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.string().describe("Authentication error message")
});

// User関連のスキーマ
export const UserSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	name: z.string().optional(),
	given_name: z.string().optional(),
	family_name: z.string().optional(),
	nickname: z.string().optional(),
	picture: z.string().optional(),
	email_verified: z.boolean().optional(),
	locale: z.string().optional(),
	roles: z.array(z.string()).default([]),
	created_at: z.string(),
	updated_at: z.string(),
	last_login: z.string().optional()
});

export const GetUserMeResponseSchema = z.object({
	success: z.literal(true),
	data: UserSchema
});

export const UpdateUserRequestSchema = z.object({
	name: z.string().optional(),
	given_name: z.string().optional(),
	family_name: z.string().optional(),
	nickname: z.string().optional(),
	picture: z.string().optional(),
	locale: z.string().optional(),
	roles: z.array(z.string()).optional(),
	email: z.string().email().optional(),
	last_login: z.string().optional()
}).refine(data => Object.keys(data).length > 0, {
	message: "At least one field must be provided for update"
});

export const UpdateUserResponseSchema = z.object({
	success: z.literal(true),
	data: UserSchema
});

export const UserIdParamSchema = z.object({
	id: z.string().min(1, "User ID is required")
});

export const DeleteUserResponseSchema = z.object({
	success: z.literal(true),
	message: z.string()
});

// Sheet関連のスキーマ
export const ColumnTypeEnum = z.enum(['string', 'number', 'datetime', 'boolean', 'pointer', 'array', 'object']);

export const CreateSheetRequestSchema = z.object({
	name: z.string().min(1, "Sheet name is required").max(100, "Sheet name must be 100 characters or less"),
	public_read: z.boolean().default(true),
	public_write: z.boolean().default(false),
	role_read: z.array(z.string()).default([]),
	role_write: z.array(z.string()).default([]),
	user_read: z.array(z.string()).default([]),
	user_write: z.array(z.string()).default([])
});

export const CreateSheetResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		name: z.string(),
		sheetId: z.number(),
		public_read: z.boolean(),
		public_write: z.boolean(),
		role_read: z.array(z.string()),
		role_write: z.array(z.string()),
		user_read: z.array(z.string()),
		user_write: z.array(z.string()),
		message: z.string()
	})
});

// Sheet update schemas
export const UpdateSheetRequestSchema = z.object({
	name: z.string().min(1, "Sheet name is required").max(100, "Sheet name must be 100 characters or less").optional(),
	public_read: z.boolean().optional(),
	public_write: z.boolean().optional(),
	role_read: z.array(z.string()).optional(),
	role_write: z.array(z.string()).optional(),
	user_read: z.array(z.string()).optional(),
	user_write: z.array(z.string()).optional()
}).refine(data => Object.keys(data).length > 0, {
	message: "At least one field must be provided for update"
});

export const UpdateSheetResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		name: z.string(),
		sheetId: z.number(),
		public_read: z.boolean(),
		public_write: z.boolean(),
		role_read: z.array(z.string()),
		role_write: z.array(z.string()),
		user_read: z.array(z.string()),
		user_write: z.array(z.string()),
		message: z.string()
	})
});

export const SheetIdParamSchema = z.object({
	id: z.string().min(1, "Sheet ID is required")
});