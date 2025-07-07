import { OpenAPIHono } from '@hono/zod-openapi';
import {
  getGoogleCredentials,
  saveGoogleTokens,
  getConfig,
  getGoogleTokens,
  refreshAccessToken,
  isTokenValid,
} from '../google-auth';
import { createSheetRoute } from '../api-routes';
import { authenticateSession } from './auth';
import { getMultipleConfigsFromSheet, getUserFromSheet } from '../utils/sheet-helpers';

type Bindings = {
	DB: D1Database;
};


// シート作成権限をチェックするヘルパー関数
async function checkSheetCreationPermission(
	userId: string,
	userRoles: string[],
	spreadsheetId: string,
	accessToken: string
): Promise<{ allowed: boolean; error?: string }> {
	try {
		// _Configシートから複数の設定を一度に取得（パフォーマンス改善）
		const configs = await getMultipleConfigsFromSheet(
			['CREATE_SHEET_BY_API', 'CREATE_SHEET_USER', 'CREATE_SHEET_ROLE'], 
			spreadsheetId, 
			accessToken
		);
		
		const createSheetByApi = configs['CREATE_SHEET_BY_API'];
		const createSheetUser = configs['CREATE_SHEET_USER'];
		const createSheetRole = configs['CREATE_SHEET_ROLE'];

		// CREATE_SHEET_BY_APIがfalseの場合は、API経由でのシート作成は禁止
		if (createSheetByApi === 'false') {
			return { allowed: false, error: 'Sheet creation via API is disabled' };
		}

		// CREATE_SHEET_USERが設定されている場合、指定されたユーザーのみ作成可能
		if (createSheetUser && createSheetUser !== '') {
			try {
				const allowedUsers = JSON.parse(createSheetUser);
				if (Array.isArray(allowedUsers) && !allowedUsers.includes(userId)) {
					return { allowed: false, error: 'User not authorized to create sheets' };
				}
			} catch (e) {
				// JSON解析エラーの場合は単一のユーザーIDとして扱う
				if (createSheetUser !== userId) {
					return { allowed: false, error: 'User not authorized to create sheets' };
				}
			}
		}

		// CREATE_SHEET_ROLEが設定されている場合、指定されたロールを持つユーザーのみ作成可能
		if (createSheetRole && createSheetRole !== '') {
			try {
				const allowedRoles = JSON.parse(createSheetRole);
				if (Array.isArray(allowedRoles)) {
					const hasRequiredRole = userRoles.some(role => allowedRoles.includes(role));
					if (!hasRequiredRole) {
						return { allowed: false, error: 'User role not authorized to create sheets' };
					}
				}
			} catch (e) {
				// JSON解析エラーの場合は単一のロール名として扱う
				if (!userRoles.includes(createSheetRole)) {
					return { allowed: false, error: 'User role not authorized to create sheets' };
				}
			}
		}

		return { allowed: true };
	} catch (error) {
		console.error('Error checking sheet creation permission:', error);
		return { allowed: false, error: 'Failed to check permissions' };
	}
}

// 新しいシートを作成するヘルパー関数
async function createGoogleSheet(
	sheetName: string,
	columns: Record<string, string>,
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; sheetId?: number; error?: string }> {
	try {
		// デフォルトカラムを定義
		const defaultColumns = [
			'id', 'created_at', 'updated_at', 'public_read', 'public_write', 
			'role_read', 'role_write', 'user_read', 'user_write'
		];
		
		// デフォルトカラムの型を定義
		const defaultColumnTypes = [
			'string', 'datetime', 'datetime', 'boolean', 'boolean',
			'array', 'array', 'array', 'array'
		];

		// ユーザー定義カラムを追加
		const userColumnNames = Object.keys(columns);
		const userColumnTypes = Object.values(columns);

		// 全カラム名と型を結合
		const allColumnNames = [...defaultColumns, ...userColumnNames];
		const allColumnTypes = [...defaultColumnTypes, ...userColumnTypes];

		// 新しいシートを作成
		const createSheetResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
			{
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					requests: [{
						addSheet: {
							properties: {
								title: sheetName
							}
						}
					}]
				})
			}
		);

		if (!createSheetResponse.ok) {
			const errorText = await createSheetResponse.text();
			console.error('Failed to create sheet:', createSheetResponse.status, errorText);
			return { success: false, error: `Failed to create sheet: ${createSheetResponse.status}` };
		}

		const createResult = await createSheetResponse.json() as any;
		const sheetId = createResult.replies?.[0]?.addSheet?.properties?.sheetId;

		if (!sheetId) {
			return { success: false, error: 'Failed to get new sheet ID' };
		}

		// ヘッダー行（1行目）に列名を設定
		const headerResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:${String.fromCharCode(65 + allColumnNames.length - 1)}1?valueInputOption=RAW`,
			{
				method: 'PUT',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					values: [allColumnNames]
				})
			}
		);

		if (!headerResponse.ok) {
			const errorText = await headerResponse.text();
			console.error('Failed to set headers:', headerResponse.status, errorText);
			return { success: false, error: `Failed to set headers: ${headerResponse.status}` };
		}

		// 型定義行（2行目）に型情報を設定
		const typeResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A2:${String.fromCharCode(65 + allColumnTypes.length - 1)}2?valueInputOption=RAW`,
			{
				method: 'PUT',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					values: [allColumnTypes]
				})
			}
		);

		if (!typeResponse.ok) {
			const errorText = await typeResponse.text();
			console.error('Failed to set types:', typeResponse.status, errorText);
			return { success: false, error: `Failed to set types: ${typeResponse.status}` };
		}

		console.log('Sheet created successfully:', sheetName, 'ID:', sheetId);
		return { success: true, sheetId };
	} catch (error) {
		console.error('Error creating Google sheet:', error);
		return { success: false, error: 'Failed to create sheet' };
	}
}

// Sheet management endpoints
export function registerSheetRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
	// POST /api/sheets - 新しいシートを作成 (OpenAPI)
	app.openapi(createSheetRoute, async (c) => {
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
			
			const userId = authResult.userId;
			if (!userId) {
				return c.json({ success: false as false, error: 'User ID not found in session' }, 401);
			}
			
			const requestData = c.req.valid('json');
			const { sheetName, columns } = requestData;
			
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
			
			// ユーザー情報を取得（権限チェック用）
			const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
			if (!user) {
				return c.json({ success: false as false, error: 'User not found in _User sheet' }, 401);
			}
			
			// シート作成権限をチェック
			const permissionCheck = await checkSheetCreationPermission(
				userId,
				user.roles || [],
				spreadsheetId,
				tokens.access_token
			);
			
			if (!permissionCheck.allowed) {
				return c.json({ 
					success: false as false, 
					error: permissionCheck.error || 'Permission denied' 
				}, 403);
			}
			
			// 新しいシートを作成
			const createResult = await createGoogleSheet(
				sheetName,
				columns,
				spreadsheetId,
				tokens.access_token
			);
			
			if (!createResult.success) {
				return c.json({ 
					success: false as false, 
					error: createResult.error || 'Failed to create sheet' 
				}, 500);
			}
			
			console.log('Sheet created successfully:', sheetName);
			
			// デフォルトカラム数（9個）とユーザー定義カラム数を合計
			const totalColumns = 9 + Object.keys(columns).length;
			
			// 成功レスポンスを返す
			return c.json({
				success: true as true,
				data: {
					sheetName,
					sheetId: createResult.sheetId!,
					columns,
					totalColumns,
					message: `Sheet '${sheetName}' created successfully with ${totalColumns} columns`
				}
			});
			
		} catch (error) {
			console.error('Error in POST /api/sheets:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as false, error: errorMessage }, 500);
		}
	});
}