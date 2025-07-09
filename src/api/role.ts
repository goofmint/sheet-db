import { OpenAPIHono } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import {
  getGoogleCredentials,
  saveGoogleTokens,
  getConfig,
  getGoogleTokens,
  refreshAccessToken,
  isTokenValid,
  type DatabaseConnection
} from '../google-auth';
import { getRolesRoute, createRoleRoute, updateRoleRoute, deleteRoleRoute } from '../api-routes';
import { authenticateSession } from './auth';
import { getUserFromSheet } from '../utils/sheet-helpers';

type Bindings = {
	DB: D1Database;
	ASSETS: Fetcher;
};

// Helper function to check role read permissions
async function checkRoleReadPermission(
	roleRow: string[],
	userId: string,
	userRoles: string[]
): Promise<boolean> {
	try {
		// If public_read is true
		if (roleRow[5] === 'TRUE') {
			return true;
		}

		// role_readに現在のユーザーのロールが含まれているかチェック
		const roleRead = roleRow[7] ? JSON.parse(roleRow[7]) : [];
		if (Array.isArray(roleRead) && userRoles.some(role => roleRead.includes(role))) {
			return true;
		}

		// user_readに現在のユーザーIDが含まれているかチェック
		const userRead = roleRow[9] ? JSON.parse(roleRow[9]) : [];
		if (Array.isArray(userRead) && userRead.includes(userId)) {
			return true;
		}

		return false;
	} catch (error) {
		console.error('Error checking role read permission:', error);
		return false;
	}
}

// Helper function to check role write permissions
async function checkRoleWritePermission(
	roleRow: string[],
	userId: string,
	userRoles: string[]
): Promise<boolean> {
	try {
		// If public_write is true
		if (roleRow[6] === 'TRUE') {
			return true;
		}

		// role_writeに現在のユーザーのロールが含まれているかチェック
		const roleWrite = roleRow[8] ? JSON.parse(roleRow[8]) : [];
		if (Array.isArray(roleWrite) && userRoles.some(role => roleWrite.includes(role))) {
			return true;
		}

		// user_writeに現在のユーザーIDが含まれているかチェック
		const userWrite = roleRow[10] ? JSON.parse(roleRow[10]) : [];
		if (Array.isArray(userWrite) && userWrite.includes(userId)) {
			return true;
		}

		return false;
	} catch (error) {
		console.error('Error checking role write permission:', error);
		return false;
	}
}

// 既存のロール名を取得するヘルパー関数
async function getExistingRoleNames(spreadsheetId: string, accessToken: string): Promise<string[]> {
	try {
		// _Roleシートのname列（A列）のデータを取得（ヘッダー行を除く）
		const response = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Role!A3:A?majorDimension=COLUMNS`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				}
			}
		);

		if (!response.ok) {
			console.error('Failed to fetch existing role names:', response.status);
			return [];
		}

		const data = await response.json() as any;
		
		// データがある場合は1列目（name列）の値を返す
		if (data.values && data.values.length > 0) {
			return data.values[0].filter((name: string) => name && name.trim() !== '');
		}
		
		return [];
	} catch (error) {
		console.error('Error getting existing role names:', error);
		return [];
	}
}

// Role management endpoints
export function registerRoleRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
	// GET /api/roles - ロール一覧取得 (OpenAPI)
	app.openapi(getRolesRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authentication header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Authenticate session
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as false, error: authResult.error || 'Authentication failed' }, 401);
			}
			
			const userId = authResult.userId;
			if (!userId) {
				return c.json({ success: false as false, error: 'User ID not found in session' }, 401);
			}
			
			// Get Google Sheets configuration
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as false, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as false, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if needed
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
			
			// Get user information
			const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
			if (!user) {
				return c.json({ success: false as false, error: 'User not found in _User sheet' }, 401);
			}
			
			// Get roles from _Role sheet
			try {
				const rolesResponse = await fetch(
					`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Role!A3:K?majorDimension=ROWS`,
					{
						headers: {
							'Authorization': `Bearer ${tokens.access_token}`,
							'Content-Type': 'application/json',
						}
					}
				);

				if (!rolesResponse.ok) {
					return c.json({ success: false as false, error: 'Failed to fetch roles data' }, 500);
				}

				const rolesData = await rolesResponse.json() as any;
				const rows = rolesData.values || [];
				
				// まず、全てのロールデータをパースして配列に変換
				const allRoles = [];
				for (const row of rows) {
					if (!row || !row[0]) continue;
					try {
						const role = {
							name: row[0],
							created_at: row[1] || '',
							updated_at: row[2] || '',
							public_read: row[5] === 'TRUE',
							public_write: row[6] === 'TRUE',
							role_read: row[7] ? JSON.parse(row[7]) : [],
							role_write: row[8] ? JSON.parse(row[8]) : [],
							user_read: row[9] ? JSON.parse(row[9]) : [],
							user_write: row[10] ? JSON.parse(row[10]) : [],
							_row: row // 内部処理用に元の行データも保持
						};
						allRoles.push(role);
					} catch (parseError) {
						console.error('Error parsing role data:', parseError, row);
						continue;
					}
				}

				// ユーザーが直接アクセス可能なロール名を取得
				const directAccessibleRoleNames = new Set<string>();
				for (const role of allRoles) {
					if (await checkRoleReadPermission(role._row, userId, user.roles || [])) {
						directAccessibleRoleNames.add(role.name);
					}
				}

				// 再帰的に、アクセス可能なロール名を拡張
				let previousSize = 0;
				while (directAccessibleRoleNames.size !== previousSize) {
					previousSize = directAccessibleRoleNames.size;
					
					for (const role of allRoles) {
						// すでにアクセス可能な場合はスキップ
						if (directAccessibleRoleNames.has(role.name)) continue;
						
						// role_readに含まれるロールのいずれかにアクセス可能な場合
						const hasAccessThroughRoles = role.role_read.some((roleName: string) => 
							directAccessibleRoleNames.has(roleName)
						);
						
						if (hasAccessThroughRoles) {
							directAccessibleRoleNames.add(role.name);
						}
					}
				}

				// 最終的にアクセス可能なロールを結果配列に追加
				const accessibleRoles = allRoles
					.filter(role => directAccessibleRoleNames.has(role.name))
					.map(role => {
						// 内部処理用の_rowプロパティを除外
						const { _row, ...cleanRole } = role;
						return cleanRole;
					});
				
				console.log('Accessible roles retrieved successfully:', accessibleRoles.length);
				
				// Return success response
				return c.json({
					success: true as true,
					data: {
						roles: accessibleRoles
					}
				});
				
			} catch (error) {
				console.error('Error fetching roles:', error);
				return c.json({ success: false as false, error: 'Failed to fetch role list' }, 500);
			}
			
		} catch (error) {
			console.error('Error in GET /api/roles:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as false, error: errorMessage }, 500);
		}
	});

	// POST /api/roles - ロール作成 (OpenAPI)
	app.openapi(createRoleRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authentication header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Session authentication
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false, error: authResult.error || 'Authentication failed' }, 401);
			}
			
			const userId = authResult.userId!;
			const { name, public_read = false, public_write = false } = c.req.valid('json');
			
			// Get Google Sheets settings
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// 既存のロール名をチェック（一意性制約）
			const existingRoleNames = await getExistingRoleNames(spreadsheetId, tokens.access_token);
			if (existingRoleNames.includes(name)) {
				return c.json({ 
					success: false, 
					error: `Role name '${name}' already exists. Please choose a different name.` 
				}, 409);
			}
			
			// 現在の日時
			const now = new Date().toISOString();
			
			// ロールデータを準備（_Roleシートのスキーマに合わせる）
			const roleData = [
				name,                    // name
				'[]',                    // users (array)
				'[]',                    // roles (array)
				now,                     // created_at
				now,                     // updated_at
				public_read ? 'TRUE' : 'FALSE',  // public_read
				public_write ? 'TRUE' : 'FALSE', // public_write
				'[]',                    // role_read (array)
				'[]',                    // role_write (array)
				JSON.stringify([userId]), // user_read: 作成者のみ読み取り可能
				JSON.stringify([userId])  // user_write: 作成者のみ書き込み可能
			];
			
			// _Roleシートにデータを追加
			const appendResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Role!A:K:append?valueInputOption=RAW`,
				{
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${tokens.access_token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						values: [roleData]
					})
				}
			);
			
			if (!appendResponse.ok) {
				const errorText = await appendResponse.text();
				console.error('Failed to create role:', appendResponse.status, errorText);
				return c.json({ success: false, error: `Failed to create role: ${appendResponse.status}` }, 500);
			}
			
			console.log('Role created successfully:', name);
			
			// 作成されたロール情報を返す
			return c.json({
				success: true,
				data: {
					name: name,
					users: [],
					roles: [],
					created_at: now,
					updated_at: now,
					public_read: public_read,
					public_write: public_write,
					role_read: [],
					role_write: [],
					user_read: [userId],
					user_write: [userId]
				}
			});
			
		} catch (error) {
			console.error('Error in POST /api/roles:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false, error: errorMessage }, 500);
		}
	});

	// PUT /api/roles/:roleName - ロール更新 (OpenAPI)
	app.openapi(updateRoleRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authentication header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Session authentication
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false, error: authResult.error || 'Authentication failed' }, 401);
			}
			
			const userId = authResult.userId!;
			const { roleName } = c.req.valid('param');
			const requestData = c.req.valid('json');
			
			// Get Google Sheets settings
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// 現在のロールデータを取得
			const roleResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Role!A:K`,
				{
					headers: {
						'Authorization': `Bearer ${tokens.access_token}`,
						'Content-Type': 'application/json',
					}
				}
			);
			
			if (!roleResponse.ok) {
				return c.json({ success: false, error: 'Failed to fetch role data' }, 500);
			}
			
			const roleData = await roleResponse.json() as any;
			const roles = roleData.values || [];
			
			// ロールを検索（3行目から検索：1行目はヘッダー、2行目は型定義）
			const roleRowIndex = roles.findIndex((row: string[], index: number) => 
				index >= 2 && row[0] === roleName
			);
			
			if (roleRowIndex === -1) {
				return c.json({ success: false, error: 'Role not found' }, 404);
			}
			
			const roleRow = roles[roleRowIndex];
			const targetRowNumber = roleRowIndex + 1; // シート行番号に変換
			
			// 現在のユーザー情報を取得（権限チェック用）
			const currentUser = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
			if (!currentUser) {
				return c.json({ success: false, error: 'Current user not found' }, 401);
			}
			
			// 権限チェック
			const hasPermission = await checkRoleWritePermission(
				roleRow,
				userId,
				currentUser.roles || []
			);
			
			if (!hasPermission) {
				return c.json({ 
					success: false, 
					error: 'Permission denied - no write access to this role' 
				}, 403);
			}
			
			// 新しい名前が指定されている場合、一意性をチェック
			if (requestData.name && requestData.name !== roleName) {
				const existingRoleNames = await getExistingRoleNames(spreadsheetId, tokens.access_token);
				if (existingRoleNames.includes(requestData.name)) {
					return c.json({ 
						success: false, 
						error: `Role name '${requestData.name}' already exists. Please choose a different name.` 
					}, 409);
				}
			}
			
			// 更新データを準備
			const now = new Date().toISOString();
			const updatedRoleData = [
				requestData.name !== undefined ? requestData.name : roleRow[0], // name
				requestData.users !== undefined ? JSON.stringify(requestData.users) : (roleRow[1] || '[]'), // users
				requestData.roles !== undefined ? JSON.stringify(requestData.roles) : (roleRow[2] || '[]'), // roles
				roleRow[3] || now, // created_at (保持)
				now, // updated_at (更新)
				requestData.public_read !== undefined ? (requestData.public_read ? 'TRUE' : 'FALSE') : (roleRow[5] || 'FALSE'), // public_read
				requestData.public_write !== undefined ? (requestData.public_write ? 'TRUE' : 'FALSE') : (roleRow[6] || 'FALSE'), // public_write
				requestData.role_read !== undefined ? JSON.stringify(requestData.role_read) : (roleRow[7] || '[]'), // role_read
				requestData.role_write !== undefined ? JSON.stringify(requestData.role_write) : (roleRow[8] || '[]'), // role_write
				requestData.user_read !== undefined ? JSON.stringify(requestData.user_read) : (roleRow[9] || '[]'), // user_read
				requestData.user_write !== undefined ? JSON.stringify(requestData.user_write) : (roleRow[10] || '[]') // user_write
			];
			
			// データを更新
			const updateResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Role!A${targetRowNumber}:K${targetRowNumber}?valueInputOption=RAW`,
				{
					method: 'PUT',
					headers: {
						'Authorization': `Bearer ${tokens.access_token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						values: [updatedRoleData]
					})
				}
			);
			
			if (!updateResponse.ok) {
				const errorText = await updateResponse.text();
				console.error('Failed to update role:', updateResponse.status, errorText);
				return c.json({ success: false, error: `Failed to update role: ${updateResponse.status}` }, 500);
			}
			
			console.log('Role updated successfully:', requestData.name || roleName);
			
			// 更新されたロール情報を返す
			return c.json({
				success: true,
				data: {
					name: updatedRoleData[0],
					users: JSON.parse(updatedRoleData[1]),
					roles: JSON.parse(updatedRoleData[2]),
					created_at: updatedRoleData[3],
					updated_at: updatedRoleData[4],
					public_read: updatedRoleData[5] === 'TRUE',
					public_write: updatedRoleData[6] === 'TRUE',
					role_read: JSON.parse(updatedRoleData[7]),
					role_write: JSON.parse(updatedRoleData[8]),
					user_read: JSON.parse(updatedRoleData[9]),
					user_write: JSON.parse(updatedRoleData[10])
				}
			});
			
		} catch (error) {
			console.error('Error in PUT /api/roles/:roleName:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false, error: errorMessage }, 500);
		}
	});

	// DELETE /api/roles/:roleName - ロール削除 (OpenAPI)
	app.openapi(deleteRoleRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authentication header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Session authentication
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({
					success: false,
					error: authResult.error || 'Authentication failed'
				}, 401);
			}
			
			const userId = authResult.userId!;
			const { roleName } = c.req.valid('param');
			
			// Get Google Sheets settings
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({
					success: false,
					error: 'No spreadsheet selected'
				}, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({
					success: false,
					error: 'No valid Google token found'
				}, 500);
			}
			
			// Check token validity and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({
						success: false,
						error: 'Failed to refresh Google token'
					}, 500);
				}
			}
			
			// 現在のロールデータを取得
			const roleResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Role!A:K`,
				{
					headers: {
						'Authorization': `Bearer ${tokens.access_token}`,
						'Content-Type': 'application/json',
					}
				}
			);
			
			if (!roleResponse.ok) {
				return c.json({
					success: false,
					error: 'Failed to fetch role data'
				}, 500);
			}
			
			const roleData = await roleResponse.json() as any;
			const roles = roleData.values || [];
			
			// ロールを検索（3行目から検索：1行目はヘッダー、2行目は型定義）
			const roleRowIndex = roles.findIndex((row: string[], index: number) => 
				index >= 2 && row[0] === roleName
			);
			
			if (roleRowIndex === -1) {
				return c.json({
					success: false,
					error: 'Role not found'
				}, 404);
			}
			
			const roleRow = roles[roleRowIndex];
			const targetRowNumber = roleRowIndex + 1; // シート行番号に変換
			
			// 現在のユーザー情報を取得（権限チェック用）
			const currentUser = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
			if (!currentUser) {
				return c.json({
					success: false,
					error: 'Current user not found'
				}, 401);
			}
			
			// 権限チェック
			const hasPermission = await checkRoleWritePermission(
				roleRow,
				userId,
				currentUser.roles || []
			);
			
			if (!hasPermission) {
				return c.json({
					success: false,
					error: 'Permission denied - no write access to this role'
				}, 403);
			}
			
			// コンフリクト防止のため、行削除ではなくデータクリアを実行
			// 全列を空文字で上書きする（ヘッダー行の列数に合わせる）
			const headerRow = roles[0] || [];
			const emptyData = new Array(headerRow.length).fill('');
			
			// データをクリア（行は残す）
			const clearResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Role!A${targetRowNumber}:K${targetRowNumber}?valueInputOption=RAW`,
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
				console.error('Failed to clear role data:', clearResponse.status, errorText);
				return c.json({
					success: false,
					error: `Failed to delete role: ${clearResponse.status}`
				}, 500);
			}
			
			console.log('Role data cleared successfully:', roleName);
			return c.json({
				success: true,
				message: `Role '${roleName}' has been successfully deleted`
			});
			
		} catch (error) {
			console.error('Error in DELETE /api/roles/:roleName:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({
				success: false,
				error: errorMessage
			}, 500);
		}
	});
}