import { OpenAPIHono } from '@hono/zod-openapi';
import {
  getGoogleCredentials,
  saveGoogleTokens,
  getConfig,
  getGoogleTokens,
  refreshAccessToken,
  isTokenValid,
} from '../google-auth';
import { createRoleRoute, updateRoleRoute, deleteRoleRoute } from '../api-routes';
import { authenticateSession } from './auth';

type Bindings = {
	DB: D1Database;
};

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
	// POST /api/roles - ロール作成 (OpenAPI)
	app.openapi(createRoleRoute, async (c) => {
		try {
			const db = c.env.DB;
			
			// 認証ヘッダーからセッションIDを取得
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// セッション認証
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false, error: authResult.error || 'Authentication failed' }, 401);
			}
			
			const { name, public_read = false, public_write = false } = c.req.valid('json');
			
			// Google Sheetsの設定を取得
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false, error: 'No spreadsheet selected' }, 500);
			}
			
			// 有効なGoogleトークンを取得
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false, error: 'No valid Google token found' }, 500);
			}
			
			// トークンの有効性を確認し、必要に応じてリフレッシュ
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
				'[]',                    // user_read (array)
				'[]'                     // user_write (array)
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
					user_read: [],
					user_write: []
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
			const db = c.env.DB;
			
			// 認証ヘッダーからセッションIDを取得
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// セッション認証
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false, error: authResult.error || 'Authentication failed' }, 401);
			}
			
			const { roleName } = c.req.valid('param');
			const requestData = c.req.valid('json');
			
			// Google Sheetsの設定を取得
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false, error: 'No spreadsheet selected' }, 500);
			}
			
			// 有効なGoogleトークンを取得
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false, error: 'No valid Google token found' }, 500);
			}
			
			// トークンの有効性を確認し、必要に応じてリフレッシュ
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
			
			// TODO: 権限チェック - 実際のアプリケーションでは、ユーザーがこのロールを編集する権限があるかチェックする
			// 今回は簡易実装として、認証されたユーザーは全てのロールを編集可能とする
			
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
			const db = c.env.DB;
			
			// 認証ヘッダーからセッションIDを取得
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// セッション認証
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({}, 401);
			}
			
			const { roleName } = c.req.valid('param');
			
			// Google Sheetsの設定を取得
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({}, 500);
			}
			
			// 有効なGoogleトークンを取得
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({}, 500);
			}
			
			// トークンの有効性を確認し、必要に応じてリフレッシュ
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({}, 500);
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
				return c.json({}, 500);
			}
			
			const roleData = await roleResponse.json() as any;
			const roles = roleData.values || [];
			
			// ロールを検索（3行目から検索：1行目はヘッダー、2行目は型定義）
			const roleRowIndex = roles.findIndex((row: string[], index: number) => 
				index >= 2 && row[0] === roleName
			);
			
			if (roleRowIndex === -1) {
				return c.json({}, 404);
			}
			
			const targetRowNumber = roleRowIndex + 1; // シート行番号に変換
			
			// TODO: 権限チェック - 実際のアプリケーションでは、ユーザーがこのロールを削除する権限があるかチェックする
			// 今回は簡易実装として、認証されたユーザーは全てのロールを削除可能とする
			
			// Google Sheets APIで行を削除
			const deleteResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
				{
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${tokens.access_token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						requests: [{
							deleteDimension: {
								range: {
									sheetId: 0, // _Roleシートのシート ID（実際の値は動的に取得すべき）
									dimension: 'ROWS',
									startIndex: targetRowNumber - 1, // 0-based index
									endIndex: targetRowNumber
								}
							}
						}]
					})
				}
			);
			
			if (!deleteResponse.ok) {
				const errorText = await deleteResponse.text();
				console.error('Failed to delete role:', deleteResponse.status, errorText);
				return c.json({}, 500);
			}
			
			console.log('Role deleted successfully:', roleName);
			return c.json({});
			
		} catch (error) {
			console.error('Error in DELETE /api/roles/:roleName:', error);
			return c.json({}, 500);
		}
	});
}