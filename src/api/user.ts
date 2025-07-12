import { OpenAPIHono } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import {
  getGoogleCredentials,
  saveGoogleTokens,
  getConfig,
  getGoogleTokens,
  refreshAccessToken,
  isTokenValid
} from '../google-auth';
import { getUserMeRoute, updateUserRoute, deleteUserRoute, deleteUserMeRoute } from '../api-routes';
import { authenticateSession } from './auth';
import { getUserFromSheet } from '../utils/sheet-helpers';
import { parseColumnSchema, validateValue } from '../utils/schema-parser';

type Bindings = {
	DB: D1Database;
	ASSETS: Fetcher;
};


// Helper function for permission checking
async function checkUserWritePermission(
	currentUserId: string,
	targetUserId: string,
	currentUserRoles: string[],
	spreadsheetId: string,
	accessToken: string
): Promise<boolean> {
	try {
		// Always allow editing for self
		if (currentUserId === targetUserId) {
			return true;
		}

		// Get target user's permission settings from _User sheet
		const response = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A:Q`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				}
			}
		);

		if (!response.ok) {
			console.error('Failed to fetch user data for permission check:', response.status);
			return false;
		}

		const data = await response.json() as any;
		const rows = data.values || [];
		
		// Search for target user (from row 3 onwards)
		const targetUserRow = rows.find((row: string[], index: number) => 
			index >= 2 && row[0] === targetUserId
		);

		if (!targetUserRow) {
			return false;
		}

		// Permission check (verify _User sheet permission settings)
		// Assumes _User sheet has public_write, role_write, user_write columns
		// Needs adjustment to match actual sheet structure
		
		// If public_write is true
		const publicWrite = targetUserRow[12] === 'TRUE'; // public_write column
		if (publicWrite) {
			return true;
		}

		// Check if current user's roles are included in role_write
		const roleWrite = targetUserRow[14] ? JSON.parse(targetUserRow[14]) : []; // role_write column
		if (Array.isArray(roleWrite) && currentUserRoles.some(role => roleWrite.includes(role))) {
			return true;
		}

		// Check if current user ID is included in user_write
		const userWrite = targetUserRow[16] ? JSON.parse(targetUserRow[16]) : []; // user_write column
		if (Array.isArray(userWrite) && userWrite.includes(currentUserId)) {
			return true;
		}

		return false;
	} catch (error) {
		console.error('Error checking user write permission:', error);
		return false;
	}
}

// Helper function for schema validation (including unique constraint checking)
async function validateUpdateDataAgainstSchema(
	updateData: any,
	spreadsheetId: string,
	accessToken: string,
	targetUserId?: string
): Promise<{ valid: boolean; error?: string }> {
	try {
		// Get row 2 (type definition row) from _User sheet
		const response = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A2:Q2`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				}
			}
		);

		if (!response.ok) {
			return { valid: false, error: 'Failed to fetch schema definition' };
		}

		const data = await response.json() as any;
		const schemaRow = data.values?.[0] || [];
		
		// Column mapping (based on _User sheet structure)
		const columnMapping = {
			id: 0,
			name: 1,
			email: 2,
			given_name: 3,
			family_name: 4,
			nickname: 5,
			picture: 6,
			email_verified: 7,
			locale: 8,
			created_at: 9,
			updated_at: 10,
			public_read: 11,
			public_write: 12,
			role_read: 13,
			role_write: 14,
			user_read: 15,
			user_write: 16
		};

		// Collect fields that need unique constraint checking
		const uniqueFields: { field: string; value: any; columnIndex: number }[] = [];

		// Type check for each field
		for (const [field, value] of Object.entries(updateData)) {
			if (value === undefined) continue;

			const columnIndex = columnMapping[field as keyof typeof columnMapping];
			if (columnIndex === undefined) {
				return { valid: false, error: `Unknown field: ${field}` };
			}

			// Parse schema definition
			const schemaDefinition = schemaRow[columnIndex] || 'string';
			const schema = parseColumnSchema(schemaDefinition);

			// Validate value
			const validation = validateValue(value, schema);
			if (!validation.valid) {
				return { valid: false, error: `Field ${field}: ${validation.error}` };
			}

			// If unique constraint checking is needed
			if (schema.unique && value !== '') {
				uniqueFields.push({ field, value, columnIndex });
			}
		}

		// Check unique constraints
		if (uniqueFields.length > 0) {
			// Get all user data
			const usersResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A:Q`,
				{
					headers: {
						'Authorization': `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					}
				}
			);

			if (!usersResponse.ok) {
				return { valid: false, error: 'Failed to check unique constraints' };
			}

			const usersData = await usersResponse.json() as any;
			const users = usersData.values || [];

			// Check each unique field (from row 3 onwards)
			for (const { field, value, columnIndex } of uniqueFields) {
				const duplicate = users.find((row: string[], index: number) => {
					// Skip header row and type definition row
					if (index < 2) return false;
					// Exclude self (for updates)
					if (targetUserId && row[0] === targetUserId) return false;
					// Check if values match
					return row[columnIndex] === value;
				});

				if (duplicate) {
					return { valid: false, error: `Field ${field} must be unique. Value '${value}' already exists.` };
				}
			}
		}

		return { valid: true };
	} catch (error) {
		console.error('Error validating update data against schema:', error);
		return { valid: false, error: 'Schema validation failed' };
	}
}

// User management endpoints
export function registerUserRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
	// GET /api/users/me - 認証されたユーザーの情報を取得 (OpenAPI)
	app.openapi(getUserMeRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authentication header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Session authentication
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as false, error: authResult.error || 'Authentication failed' }, 401);
			}
			
			// 認証されたユーザーIDを取得
			const userId = authResult.userId;
			if (!userId) {
				return c.json({ success: false as false, error: 'User ID not found in session' }, 401);
			}
			
			// Get Google Sheets settings
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as false, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as false, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as false, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// _Userシートからユーザー情報を取得
			const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
			if (!user) {
				return c.json({ success: false as false, error: 'User not found in _User sheet' }, 404);
			}
			
			console.log('User information retrieved successfully for user:', userId);
			
			// ユーザー情報を返す
			return c.json({
				success: true as true,
				data: user
			});
			
		} catch (error) {
			console.error('Error in GET /api/users/me:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as false, error: errorMessage }, 500);
		}
	});

	// PUT /api/users/:id - ユーザー情報更新 (OpenAPI)
	app.openapi(updateUserRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authentication header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Session authentication
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as false, error: authResult.error || 'Authentication failed' }, 401);
			}
			
			const currentUserId = authResult.userId;
			if (!currentUserId) {
				return c.json({ success: false as false, error: 'User ID not found in session' }, 401);
			}
			
			const { id: targetUserId } = c.req.valid('param');
			const updateData = c.req.valid('json');
			
			// 更新不可フィールドのチェック
			const readOnlyFields = ['id', 'created_at', 'updated_at', 'email_verified'];
			for (const field of readOnlyFields) {
				if ((updateData as any)[field] !== undefined) {
					return c.json({ 
						success: false as false, 
						error: `Field '${field}' is read-only and cannot be updated` 
					}, 400);
				}
			}
			
			// Get Google Sheets settings
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as false, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as false, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as false, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get current user information (for permission check)
			const currentUser = await getUserFromSheet(currentUserId, spreadsheetId, tokens.access_token);
			if (!currentUser) {
				return c.json({ success: false as false, error: 'Current user not found' }, 401);
			}
			
			// Check target user existence
			const targetUser = await getUserFromSheet(targetUserId, spreadsheetId, tokens.access_token);
			if (!targetUser) {
				return c.json({ success: false as false, error: 'Target user not found' }, 404);
			}
			
			// Permission check
			const hasPermission = await checkUserWritePermission(
				currentUserId,
				targetUserId,
				currentUser.roles || [],
				spreadsheetId,
				tokens.access_token
			);
			
			if (!hasPermission) {
				return c.json({ 
					success: false as false, 
					error: 'Permission denied - no write access to this user' 
				}, 403);
			}
			
			// スキーマ検証（ターゲットユーザーIDを渡してユニーク制約チェックで自分自身を除外）
			const schemaValidation = await validateUpdateDataAgainstSchema(
				updateData,
				spreadsheetId,
				tokens.access_token,
				targetUserId
			);
			
			if (!schemaValidation.valid) {
				return c.json({ 
					success: false as false, 
					error: schemaValidation.error || 'Schema validation failed' 
				}, 400);
			}
			
			// 現在のユーザーデータを取得して更新
			const userResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A:Q`,
				{
					headers: {
						'Authorization': `Bearer ${tokens.access_token}`,
						'Content-Type': 'application/json',
					}
				}
			);
			
			if (!userResponse.ok) {
				return c.json({ success: false as false, error: 'Failed to fetch user data' }, 500);
			}
			
			const userData = await userResponse.json() as any;
			const users = userData.values || [];
			
			// Search for user (from row 3)
			const userRowIndex = users.findIndex((row: string[], index: number) => 
				index >= 2 && row[0] === targetUserId
			);
			
			if (userRowIndex === -1) {
				return c.json({ success: false as false, error: 'User not found' }, 404);
			}
			
			const userRow = users[userRowIndex];
			const targetRowNumber = userRowIndex + 1; // Convert to sheet row number
			
			// 更新データを準備
			const now = new Date().toISOString();
			const updatedUserData = [
				targetUserId, // id（変更不可）
				updateData.name !== undefined ? updateData.name : userRow[1], // name
				updateData.email !== undefined ? updateData.email : userRow[2], // email
				updateData.given_name !== undefined ? updateData.given_name : userRow[3], // given_name
				updateData.family_name !== undefined ? updateData.family_name : userRow[4], // family_name
				updateData.nickname !== undefined ? updateData.nickname : userRow[5], // nickname
				updateData.picture !== undefined ? updateData.picture : userRow[6], // picture
				// emailが更新された場合はemail_verifiedをfalseに、そうでなければ現在の値を保持
				updateData.email !== undefined ? 'FALSE' : (userRow[7] || 'FALSE'), // email_verified
				updateData.locale !== undefined ? updateData.locale : userRow[8], // locale
				userRow[9] || now, // created_at（保持）
				now, // updated_at（更新）
				updateData.public_read !== undefined ? (updateData.public_read ? 'TRUE' : 'FALSE') : (userRow[11] || 'FALSE'), // public_read
				updateData.public_write !== undefined ? (updateData.public_write ? 'TRUE' : 'FALSE') : (userRow[12] || 'FALSE'), // public_write
				updateData.role_read !== undefined ? JSON.stringify(updateData.role_read) : (userRow[13] || '[]'), // role_read
				updateData.role_write !== undefined ? JSON.stringify(updateData.role_write) : (userRow[14] || '[]'), // role_write
				updateData.user_read !== undefined ? JSON.stringify(updateData.user_read) : (userRow[15] || '[]'), // user_read
				updateData.user_write !== undefined ? JSON.stringify(updateData.user_write) : (userRow[16] || '[]') // user_write
			];
			
			// データを更新
			const updateResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A${targetRowNumber}:Q${targetRowNumber}?valueInputOption=RAW`,
				{
					method: 'PUT',
					headers: {
						'Authorization': `Bearer ${tokens.access_token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						values: [updatedUserData]
					})
				}
			);
			
			if (!updateResponse.ok) {
				const errorText = await updateResponse.text();
				console.error('Failed to update user:', updateResponse.status, errorText);
				return c.json({ success: false as false, error: `Failed to update user: ${updateResponse.status}` }, 500);
			}
			
			console.log('User updated successfully:', targetUserId);
			
			// 更新されたユーザー情報を返す
			const updatedUser = {
				id: updatedUserData[0],
				name: updatedUserData[1],
				email: updatedUserData[2],
				given_name: updatedUserData[3] || undefined,
				family_name: updatedUserData[4] || undefined,
				nickname: updatedUserData[5] || undefined,
				picture: updatedUserData[6] || undefined,
				email_verified: updatedUserData[7] === 'TRUE',
				locale: updatedUserData[8] || undefined,
				created_at: updatedUserData[9],
				updated_at: updatedUserData[10],
				public_read: updatedUserData[11] === 'TRUE',
				public_write: updatedUserData[12] === 'TRUE',
				role_read: JSON.parse(updatedUserData[13]),
				role_write: JSON.parse(updatedUserData[14]),
				user_read: JSON.parse(updatedUserData[15]),
				user_write: JSON.parse(updatedUserData[16])
			};
			
			return c.json({
				success: true as true,
				data: updatedUser
			});
			
		} catch (error) {
			console.error('Error in PUT /api/users/:id:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as false, error: errorMessage }, 500);
		}
	});

	// DELETE /api/users/:id - ユーザー情報削除 (OpenAPI)
	app.openapi(deleteUserRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authentication header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Session authentication
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as false, error: authResult.error || 'Authentication failed' }, 401);
			}
			
			const currentUserId = authResult.userId;
			if (!currentUserId) {
				return c.json({ success: false as false, error: 'User ID not found in session' }, 401);
			}
			
			const { id: targetUserId } = c.req.valid('param');
			
			// Get Google Sheets settings
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as false, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as false, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as false, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get current user information (for permission check)
			const currentUser = await getUserFromSheet(currentUserId, spreadsheetId, tokens.access_token);
			if (!currentUser) {
				return c.json({ success: false as false, error: 'Current user not found' }, 401);
			}
			
			// Check target user existence
			const targetUser = await getUserFromSheet(targetUserId, spreadsheetId, tokens.access_token);
			if (!targetUser) {
				return c.json({ success: false as false, error: 'Target user not found' }, 404);
			}
			
			// Permission check
			const hasPermission = await checkUserWritePermission(
				currentUserId,
				targetUserId,
				currentUser.roles || [],
				spreadsheetId,
				tokens.access_token
			);
			
			if (!hasPermission) {
				return c.json({ 
					success: false as false, 
					error: 'Permission denied - no write access to this user' 
				}, 403);
			}
			
			// 現在のユーザーデータを取得して行位置を特定
			const userResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A:Q`,
				{
					headers: {
						'Authorization': `Bearer ${tokens.access_token}`,
						'Content-Type': 'application/json',
					}
				}
			);
			
			if (!userResponse.ok) {
				return c.json({ success: false as false, error: 'Failed to fetch user data' }, 500);
			}
			
			const userData = await userResponse.json() as any;
			const users = userData.values || [];
			
			// Search for user (from row 3)
			const userRowIndex = users.findIndex((row: string[], index: number) => 
				index >= 2 && row[0] === targetUserId
			);
			
			if (userRowIndex === -1) {
				return c.json({ success: false as false, error: 'User not found' }, 404);
			}
			
			const targetRowNumber = userRowIndex + 1; // Convert to sheet row number
			
			// コンフリクト防止のため、行削除ではなくデータクリアを実行
			// 全列を空文字で上書きする（ヘッダー行の列数に合わせる）
			const headerRow = users[0] || [];
			const emptyData = new Array(headerRow.length).fill('');
			
			// データをクリア（行は残す）
			const clearResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A${targetRowNumber}:Q${targetRowNumber}?valueInputOption=RAW`,
				{
					method: 'PUT',
					headers: {
						'Authorization': `Bearer ${tokens.access_token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						values: [emptyData]
					})
				}
			);
			
			if (!clearResponse.ok) {
				const errorText = await clearResponse.text();
				console.error('Failed to clear user data:', clearResponse.status, errorText);
				return c.json({ success: false as false, error: `Failed to delete user: ${clearResponse.status}` }, 500);
			}
			
			console.log('User data cleared successfully:', targetUserId);
			
			return c.json({
				success: true as true,
				message: `User '${targetUserId}' has been successfully deleted`
			});
			
		} catch (error) {
			console.error('Error in DELETE /api/users/:id:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as false, error: errorMessage }, 500);
		}
	});

	// DELETE /api/users/me - Delete current authenticated user
	app.openapi(deleteUserMeRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authentication header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Session authentication
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as false, error: authResult.error || 'Authentication failed' }, 401);
			}
			
			const currentUserId = authResult.userId;
			if (!currentUserId) {
				return c.json({ success: false as false, error: 'User ID not found in session' }, 401);
			}
			
			// Get Google Sheets settings
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as false, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as false, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as false, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Check if user exists in _User sheet
			const targetUser = await getUserFromSheet(currentUserId, spreadsheetId, tokens.access_token);
			if (!targetUser) {
				return c.json({ success: false as false, error: 'User not found in _User sheet' }, 404);
			}
			
			// Get current user data to find row position
			const userResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A:Q`,
				{
					headers: {
						'Authorization': `Bearer ${tokens.access_token}`,
						'Content-Type': 'application/json',
					}
				}
			);
			
			if (!userResponse.ok) {
				return c.json({ success: false as false, error: 'Failed to fetch user data' }, 500);
			}
			
			const userData = await userResponse.json() as any;
			const users = userData.values || [];
			
			// Search for user (from row 3)
			const userRowIndex = users.findIndex((row: string[], index: number) => 
				index >= 2 && row[0] === currentUserId
			);
			
			if (userRowIndex === -1) {
				return c.json({ success: false as false, error: 'User not found in _User sheet' }, 404);
			}
			
			const targetRowNumber = userRowIndex + 1; // Convert to sheet row number
			
			// Clear user data to prevent row shifting conflicts
			// Create empty data array matching the header row length
			const headerRow = users[0] || [];
			const emptyData = new Array(headerRow.length).fill('');
			
			// Clear the user data (keep the row but clear all data)
			const clearResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A${targetRowNumber}:Q${targetRowNumber}?valueInputOption=RAW`,
				{
					method: 'PUT',
					headers: {
						'Authorization': `Bearer ${tokens.access_token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						values: [emptyData]
					})
				}
			);
			
			if (!clearResponse.ok) {
				const errorText = await clearResponse.text();
				console.error('Failed to clear user data:', clearResponse.status, errorText);
				return c.json({ success: false as false, error: `Failed to delete user: ${clearResponse.status}` }, 500);
			}
			
			console.log('User data cleared successfully:', currentUserId);
			
			return c.json({
				success: true as true,
				message: 'User account has been successfully deleted'
			});
			
		} catch (error) {
			console.error('Error in DELETE /api/users/me:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as false, error: errorMessage }, 500);
		}
	});
}