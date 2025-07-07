import { OpenAPIHono } from '@hono/zod-openapi';
import {
  getGoogleCredentials,
  saveGoogleTokens,
  getConfig,
  getGoogleTokens,
  refreshAccessToken,
  isTokenValid,
} from '../google-auth';
import { getUserMeRoute, updateUserRoute, deleteUserRoute } from '../api-routes';
import { authenticateSession } from './auth';
import { getUserFromSheet } from '../utils/sheet-helpers';

type Bindings = {
	DB: D1Database;
};


// 権限チェック用のヘルパー関数
async function checkUserWritePermission(
	currentUserId: string,
	targetUserId: string,
	currentUserRoles: string[],
	spreadsheetId: string,
	accessToken: string
): Promise<boolean> {
	try {
		// 自分自身の場合は常に編集可能
		if (currentUserId === targetUserId) {
			return true;
		}

		// _Userシートから対象ユーザーの権限設定を取得
		const response = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A:N`,
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
		
		// 対象ユーザーを検索（3行目以降から）
		const targetUserRow = rows.find((row: string[], index: number) => 
			index >= 2 && row[0] === targetUserId
		);

		if (!targetUserRow) {
			return false;
		}

		// 権限チェック（_Userシートの権限設定を確認）
		// 仮定: _Userシートにpublic_write, role_write, user_writeの列があるとします
		// 実際のシート構造に合わせて調整が必要
		
		// public_writeがtrueの場合
		const publicWrite = targetUserRow[13] === 'TRUE'; // 仮の列位置
		if (publicWrite) {
			return true;
		}

		// role_writeに現在のユーザーのロールが含まれているかチェック
		const roleWrite = targetUserRow[14] ? JSON.parse(targetUserRow[14]) : []; // 仮の列位置
		if (Array.isArray(roleWrite) && currentUserRoles.some(role => roleWrite.includes(role))) {
			return true;
		}

		// user_writeに現在のユーザーIDが含まれているかチェック
		const userWrite = targetUserRow[15] ? JSON.parse(targetUserRow[15]) : []; // 仮の列位置
		if (Array.isArray(userWrite) && userWrite.includes(currentUserId)) {
			return true;
		}

		return false;
	} catch (error) {
		console.error('Error checking user write permission:', error);
		return false;
	}
}

// スキーマ検証用のヘルパー関数
async function validateUpdateDataAgainstSchema(
	updateData: any,
	spreadsheetId: string,
	accessToken: string
): Promise<{ valid: boolean; error?: string }> {
	try {
		// _Userシートの2行目（型定義行）を取得
		const response = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A2:N2`,
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
		
		// 列のマッピング（_Userシートの構造に基づく）
		const columnMapping = {
			id: 0,
			email: 1,
			name: 2,
			given_name: 3,
			family_name: 4,
			nickname: 5,
			picture: 6,
			email_verified: 7,
			locale: 8,
			roles: 9,
			created_at: 10,
			updated_at: 11,
			last_login: 12
		};

		// 各フィールドの型チェック
		for (const [field, value] of Object.entries(updateData)) {
			if (value === undefined) continue;

			const columnIndex = columnMapping[field as keyof typeof columnMapping];
			if (columnIndex === undefined) {
				return { valid: false, error: `Unknown field: ${field}` };
			}

			const schemaType = schemaRow[columnIndex] || '';

			// 型チェックの実装
			switch (schemaType.toLowerCase()) {
				case 'string':
					if (typeof value !== 'string') {
						return { valid: false, error: `Field ${field} must be a string` };
					}
					break;
				case 'email':
					if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
						return { valid: false, error: `Field ${field} must be a valid email address` };
					}
					break;
				case 'array':
					if (!Array.isArray(value)) {
						return { valid: false, error: `Field ${field} must be an array` };
					}
					break;
				case 'boolean':
					if (typeof value !== 'boolean') {
						return { valid: false, error: `Field ${field} must be a boolean` };
					}
					break;
				case 'datetime':
					if (typeof value !== 'string' || isNaN(Date.parse(value))) {
						return { valid: false, error: `Field ${field} must be a valid datetime string` };
					}
					break;
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
			const db = c.env.DB;
			
			// 認証ヘッダーからセッションIDを取得
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// セッション認証
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as false, error: authResult.error || 'Authentication failed' }, 401);
			}
			
			// 認証されたユーザーIDを取得
			const userId = authResult.userId;
			if (!userId) {
				return c.json({ success: false as false, error: 'User ID not found in session' }, 401);
			}
			
			// Google Sheetsの設定を取得
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as false, error: 'No spreadsheet selected' }, 500);
			}
			
			// 有効なGoogleトークンを取得
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as false, error: 'No valid Google token found' }, 500);
			}
			
			// トークンの有効性を確認し、必要に応じてリフレッシュ
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
			const db = c.env.DB;
			
			// 認証ヘッダーからセッションIDを取得
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// セッション認証
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
			
			// Google Sheetsの設定を取得
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as false, error: 'No spreadsheet selected' }, 500);
			}
			
			// 有効なGoogleトークンを取得
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as false, error: 'No valid Google token found' }, 500);
			}
			
			// トークンの有効性を確認し、必要に応じてリフレッシュ
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
			
			// 現在のユーザー情報を取得（権限チェック用）
			const currentUser = await getUserFromSheet(currentUserId, spreadsheetId, tokens.access_token);
			if (!currentUser) {
				return c.json({ success: false as false, error: 'Current user not found' }, 401);
			}
			
			// 対象ユーザーの存在確認
			const targetUser = await getUserFromSheet(targetUserId, spreadsheetId, tokens.access_token);
			if (!targetUser) {
				return c.json({ success: false as false, error: 'Target user not found' }, 404);
			}
			
			// 権限チェック
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
			
			// スキーマ検証
			const schemaValidation = await validateUpdateDataAgainstSchema(
				updateData,
				spreadsheetId,
				tokens.access_token
			);
			
			if (!schemaValidation.valid) {
				return c.json({ 
					success: false as false, 
					error: schemaValidation.error || 'Schema validation failed' 
				}, 400);
			}
			
			// 現在のユーザーデータを取得して更新
			const userResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A:N`,
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
			
			// ユーザーを検索（3行目から検索）
			const userRowIndex = users.findIndex((row: string[], index: number) => 
				index >= 2 && row[0] === targetUserId
			);
			
			if (userRowIndex === -1) {
				return c.json({ success: false as false, error: 'User not found' }, 404);
			}
			
			const userRow = users[userRowIndex];
			const targetRowNumber = userRowIndex + 1; // シート行番号に変換
			
			// 更新データを準備
			const now = new Date().toISOString();
			const updatedUserData = [
				targetUserId, // id（変更不可）
				updateData.email !== undefined ? updateData.email : userRow[1], // email
				updateData.name !== undefined ? updateData.name : userRow[2], // name
				updateData.given_name !== undefined ? updateData.given_name : userRow[3], // given_name
				updateData.family_name !== undefined ? updateData.family_name : userRow[4], // family_name
				updateData.nickname !== undefined ? updateData.nickname : userRow[5], // nickname
				updateData.picture !== undefined ? updateData.picture : userRow[6], // picture
				// emailが更新された場合はemail_verifiedをfalseに、そうでなければ現在の値を保持
				updateData.email !== undefined ? 'FALSE' : (userRow[7] || 'FALSE'), // email_verified
				updateData.locale !== undefined ? updateData.locale : userRow[8], // locale
				updateData.roles !== undefined ? JSON.stringify(updateData.roles) : (userRow[9] || '[]'), // roles
				userRow[10] || now, // created_at（保持）
				now, // updated_at（更新）
				updateData.last_login !== undefined ? updateData.last_login : userRow[12] // last_login
			];
			
			// データを更新
			const updateResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A${targetRowNumber}:N${targetRowNumber}?valueInputOption=RAW`,
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
				email: updatedUserData[1],
				name: updatedUserData[2] || undefined,
				given_name: updatedUserData[3] || undefined,
				family_name: updatedUserData[4] || undefined,
				nickname: updatedUserData[5] || undefined,
				picture: updatedUserData[6] || undefined,
				email_verified: updatedUserData[7] === 'TRUE' || undefined,
				locale: updatedUserData[8] || undefined,
				roles: JSON.parse(updatedUserData[9]),
				created_at: updatedUserData[10],
				updated_at: updatedUserData[11],
				last_login: updatedUserData[12] || undefined
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
			const db = c.env.DB;
			
			// 認証ヘッダーからセッションIDを取得
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// セッション認証
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as false, error: authResult.error || 'Authentication failed' }, 401);
			}
			
			const currentUserId = authResult.userId;
			if (!currentUserId) {
				return c.json({ success: false as false, error: 'User ID not found in session' }, 401);
			}
			
			const { id: targetUserId } = c.req.valid('param');
			
			// Google Sheetsの設定を取得
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as false, error: 'No spreadsheet selected' }, 500);
			}
			
			// 有効なGoogleトークンを取得
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as false, error: 'No valid Google token found' }, 500);
			}
			
			// トークンの有効性を確認し、必要に応じてリフレッシュ
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
			
			// 現在のユーザー情報を取得（権限チェック用）
			const currentUser = await getUserFromSheet(currentUserId, spreadsheetId, tokens.access_token);
			if (!currentUser) {
				return c.json({ success: false as false, error: 'Current user not found' }, 401);
			}
			
			// 対象ユーザーの存在確認
			const targetUser = await getUserFromSheet(targetUserId, spreadsheetId, tokens.access_token);
			if (!targetUser) {
				return c.json({ success: false as false, error: 'Target user not found' }, 404);
			}
			
			// 権限チェック
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
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A:N`,
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
			
			// ユーザーを検索（3行目から検索）
			const userRowIndex = users.findIndex((row: string[], index: number) => 
				index >= 2 && row[0] === targetUserId
			);
			
			if (userRowIndex === -1) {
				return c.json({ success: false as false, error: 'User not found' }, 404);
			}
			
			const targetRowNumber = userRowIndex + 1; // シート行番号に変換
			
			// コンフリクト防止のため、行削除ではなくデータクリアを実行
			// 全列を空文字で上書きする（ヘッダー行の列数に合わせる）
			const headerRow = users[0] || [];
			const emptyData = new Array(headerRow.length).fill('');
			
			// データをクリア（行は残す）
			const clearResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A${targetRowNumber}:N${targetRowNumber}?valueInputOption=RAW`,
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
}