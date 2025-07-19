import { z } from 'zod';

// Common schemas
export const ErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.string()
});

export const BearerAuthSchema = z.object({
	Authorization: z.string().regex(/^Bearer .+/, "Authorization header must be in format 'Bearer <token>'")
});

// Role-related schemas
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

// Role list schema
export const GetRolesResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		roles: z.array(RoleSchema)
	})
});

// Parameter schemas
export const RoleNameParamSchema = z.object({
	roleName: z.string().min(1, "Role name is required")
});

// Error response schemas
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

// Authentication schemas
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

// Login schema (direct Auth0 token validation)
export const LoginRequestSchema = z.object({
	token: z.string().min(1, "Auth0 access token is required"),
	userInfo: z.object({
		sub: z.string().min(1, "User ID (sub) is required"),
		email: z.string().email("Valid email is required"),
		name: z.string().optional(),
		given_name: z.string().optional(),
		family_name: z.string().optional(),
		nickname: z.string().optional(),
		picture: z.string().optional(),
		email_verified: z.boolean().optional(),
		locale: z.string().optional()
	})
});

export const LoginResponseSchema = z.object({
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
			locale: z.string().optional(),
			created_at: z.string(),
			updated_at: z.string(),
			public_read: z.boolean(),
			public_write: z.boolean(),
			role_read: z.array(z.string()),
			role_write: z.array(z.string()),
			user_read: z.array(z.string()),
			user_write: z.array(z.string())
		}),
		session: z.object({
			id: z.string(),
			user_id: z.string(),
			expires_at: z.string(),
			created_at: z.string(),
			updated_at: z.string()
		})
	})
});

// Logout schema
export const LogoutResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({})
});

// User schemas
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

// Sheet-related schemas
export const ColumnTypeEnum = z.enum(['string', 'number', 'datetime', 'boolean', 'pointer', 'array', 'object', 'image']);

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

// Sheet delete schema
export const DeleteSheetResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({})
});

// Sheet list schema
export const SheetListItemSchema = z.object({
	sheetId: z.number(),
	name: z.string()
});

export const GetSheetsResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		sheets: z.array(SheetListItemSchema)
	})
});

// Sheet metadata schema
export const SheetColumnSchema = z.object({
	name: z.string(),
	type: ColumnTypeEnum,
	required: z.boolean().default(false)
});

export const GetSheetMetadataResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		sheetId: z.number(),
		name: z.string(),
		columns: z.array(SheetColumnSchema),
		public_read: z.boolean(),
		public_write: z.boolean(),
		role_read: z.array(z.string()),
		role_write: z.array(z.string()),
		user_read: z.array(z.string()),
		user_write: z.array(z.string())
	})
});

// Column definition schema for adding columns
export const ColumnDefinitionSchema = z.object({
	type: ColumnTypeEnum,
	unique: z.boolean().optional(),
	pattern: z.string().optional(),
	minLength: z.number().int().min(0).optional(),
	maxLength: z.number().int().min(0).optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	default: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional()
});

// Add columns request schema
export const AddColumnsRequestSchema = z.record(z.string(), ColumnDefinitionSchema).refine(
	(data) => Object.keys(data).length > 0,
	{
		message: "At least one column must be provided"
	}
);

// Add columns response schema
export const AddColumnsResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		sheetId: z.number(),
		name: z.string(),
		addedColumns: z.array(z.object({
			name: z.string(),
			type: ColumnTypeEnum,
			unique: z.boolean().optional(),
			pattern: z.string().optional(),
			minLength: z.number().optional(),
			maxLength: z.number().optional(),
			min: z.number().optional(),
			max: z.number().optional(),
			default: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional()
		})),
		message: z.string()
	})
});

// Column ID parameter schema
export const ColumnIdParamSchema = z.object({
	columnId: z.string().min(1, "Column ID is required")
});

// Delete column response schema
export const DeleteColumnResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		sheetId: z.number(),
		name: z.string(),
		columnName: z.string(),
		action: z.enum(['deleted', 'cleared']),
		message: z.string()
	})
});

// Update column request schema
export const UpdateColumnRequestSchema = z.object({
	name: z.string().min(1, "Column name must be a non-empty string").optional(),
	pattern: z.string().optional(),
	minLength: z.number().int().min(0).optional(),
	maxLength: z.number().int().min(0).optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	default: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional()
}).refine(data => Object.keys(data).length > 0, {
	message: "At least one field must be provided for update"
}).refine(data => !('type' in data), {
	message: "Type modification is not allowed"
});

// Update column response schema
export const UpdateColumnResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		sheetId: z.number(),
		name: z.string(),
		columnName: z.string(),
		updatedColumn: z.object({
			name: z.string(),
			type: ColumnTypeEnum,
			pattern: z.string().optional(),
			minLength: z.number().optional(),
			maxLength: z.number().optional(),
			min: z.number().optional(),
			max: z.number().optional(),
			default: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional()
		}),
		message: z.string()
	})
});

// Get column info response schema
export const GetColumnInfoResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		sheetId: z.number(),
		sheetName: z.string(),
		columnName: z.string(),
		schema: z.object({
			type: ColumnTypeEnum,
			required: z.boolean().optional(),
			unique: z.boolean().optional(),
			pattern: z.string().optional(),
			minLength: z.number().optional(),
			maxLength: z.number().optional(),
			min: z.number().optional(),
			max: z.number().optional(),
			default: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional()
		})
	})
});

// Sheet data query schemas
export const GetSheetDataQuerySchema = z.object({
	query: z.string().optional(),
	where: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(1000).optional(),
	page: z.coerce.number().int().min(1).optional(),
	order: z.string().optional(),
	count: z.coerce.boolean().optional()
});

export const GetSheetDataResponseSchema = z.object({
	success: z.literal(true),
	results: z.array(z.record(z.string(), z.any())),
	count: z.number().int().optional()
});

// Create sheet data schemas
export const CreateSheetDataRequestSchema = z.record(z.string(), z.any())
	.refine((data) => !Object.hasOwn(data, 'id'), {
		message: "Field 'id' cannot be specified - it will be generated automatically"
	})
	.refine((data) => !Object.hasOwn(data, 'created_at'), {
		message: "Field 'created_at' cannot be specified - it will be generated automatically"
	})
	.refine((data) => !Object.hasOwn(data, 'updated_at'), {
		message: "Field 'updated_at' cannot be specified - it will be generated automatically"
	});

export const CreateSheetDataResponseSchema = z.object({
	success: z.literal(true),
	data: z.record(z.string(), z.any())
});

// Update sheet data schemas
export const DataIdParamSchema = z.object({
	id: z.string().min(1, "Sheet ID is required"),
	dataId: z.string().min(1, "Data ID is required")
});

export const UpdateSheetDataRequestSchema = z.record(z.string(), z.any())
	.refine((data) => !Object.hasOwn(data, 'id'), {
		message: "Field 'id' cannot be updated"
	})
	.refine((data) => !Object.hasOwn(data, 'created_at'), {
		message: "Field 'created_at' cannot be updated"
	})
	.refine((data) => !Object.hasOwn(data, 'updated_at'), {
		message: "Field 'updated_at' cannot be updated"
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided for update"
	});

export const UpdateSheetDataResponseSchema = z.object({
	success: z.literal(true),
	data: z.record(z.string(), z.any())
});

// Delete sheet data response schema
export const DeleteSheetDataResponseSchema = z.object({});

// File upload schemas
export const FileUploadResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		url: z.string().describe("HTTPS URL to access the uploaded file"),
		fileName: z.string().describe("Original filename"),
		contentType: z.string().describe("Content-Type of the file"),
		fileSize: z.number().describe("File size in bytes")
	})
});

export const FileUploadErrorSchema = z.object({
	success: z.literal(false),
	error: z.string().describe("File upload error message")
});