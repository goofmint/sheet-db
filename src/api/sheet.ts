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
import { getSheetsRoute, createSheetRoute, updateSheetRoute, deleteSheetRoute, getSheetMetadataRoute, addColumnsRoute, modifyColumnRoute } from '../api-routes';
import { authenticateSession } from './auth';
import { getMultipleConfigsFromSheet, getUserFromSheet } from '../utils/sheet-helpers';

type Bindings = {
	DB: D1Database;
	ASSETS: Fetcher;
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

// シート更新権限をチェックするヘルパー関数（シート固有の権限をチェック）
async function checkSheetUpdatePermission(
	userId: string,
	userRoles: string[],
	sheetMetadata: any
): Promise<{ allowed: boolean; error?: string }> {
	try {
		// シートのメタデータから権限情報を取得
		const { public_write, role_write, user_write } = sheetMetadata;

		// 1. public_write = true の場合、誰でも更新可能
		if (public_write === true) {
			return { allowed: true };
		}

		// 2. user_writeに該当ユーザーIDが含まれている場合
		if (user_write && Array.isArray(user_write) && user_write.includes(userId)) {
			return { allowed: true };
		}

		// 3. role_writeに該当ユーザーのロールが含まれている場合
		if (role_write && Array.isArray(role_write) && userRoles) {
			const hasRequiredRole = userRoles.some(role => role_write.includes(role));
			if (hasRequiredRole) {
				return { allowed: true };
			}
		}

		return { allowed: false, error: 'No write permission for this sheet' };
	} catch (error) {
		console.error('Error checking sheet update permission:', error);
		return { allowed: false, error: 'Failed to check permissions' };
	}
}

// Check column modification permission helper function
async function checkColumnModifyPermission(
	userId: string,
	userRoles: string[],
	spreadsheetId: string,
	accessToken: string
): Promise<{ allowed: boolean; error?: string }> {
	try {
		// Get column modification settings from _Config sheet
		const configs = await getMultipleConfigsFromSheet(
			['MODIFY_COLUMNS_BY_API', 'MODIFY_SHEET_USER', 'MODIFY_SHEET_ROLE'], 
			spreadsheetId, 
			accessToken
		);
		
		const modifyColumnsByApi = configs['MODIFY_COLUMNS_BY_API'];
		const modifySheetUser = configs['MODIFY_SHEET_USER'];
		const modifySheetRole = configs['MODIFY_SHEET_ROLE'];

		// If MODIFY_COLUMNS_BY_API is false, column modification via API is disabled
		if (modifyColumnsByApi === 'false' || !modifyColumnsByApi) {
			return { allowed: false, error: 'Column modification via API is disabled' };
		}

		// Check if user is in MODIFY_SHEET_USER list
		if (modifySheetUser && modifySheetUser !== '') {
			try {
				const allowedUsers = JSON.parse(modifySheetUser);
				if (Array.isArray(allowedUsers) && !allowedUsers.includes(userId)) {
					return { allowed: false, error: 'User not authorized to modify columns' };
				}
			} catch (e) {
				// If JSON parsing fails, treat as single user ID
				if (modifySheetUser !== userId) {
					return { allowed: false, error: 'User not authorized to modify columns' };
				}
			}
		}

		// Check if user has required role in MODIFY_SHEET_ROLE
		if (modifySheetRole && modifySheetRole !== '') {
			try {
				const allowedRoles = JSON.parse(modifySheetRole);
				if (Array.isArray(allowedRoles)) {
					const hasRequiredRole = userRoles.some(role => allowedRoles.includes(role));
					if (!hasRequiredRole) {
						return { allowed: false, error: 'User role not authorized to modify columns' };
					}
				}
			} catch (e) {
				// If JSON parsing fails, treat as single role name
				if (!userRoles.includes(modifySheetRole)) {
					return { allowed: false, error: 'User role not authorized to modify columns' };
				}
			}
		}

		// If MODIFY_COLUMNS_BY_API is true but no user/role restrictions, deny by default
		if ((!modifySheetUser || modifySheetUser === '') && (!modifySheetRole || modifySheetRole === '')) {
			return { allowed: false, error: 'No users or roles configured for column modification' };
		}

		return { allowed: true };
	} catch (error) {
		console.error('Error checking column modification permission:', error);
		return { allowed: false, error: 'Failed to check permissions' };
	}
}

// シート読み取り権限をチェックするヘルパー関数
async function checkSheetReadPermission(
	userId: string | null,
	userRoles: string[],
	sheetMetadata: any
): Promise<{ allowed: boolean; error?: string }> {
	try {
		// シートのメタデータから権限情報を取得
		const { public_read, role_read, user_read } = sheetMetadata;

		// 1. public_read = true の場合、誰でも読み取り可能
		if (public_read === true) {
			return { allowed: true };
		}

		// 認証されていないユーザーは public_read = false の場合アクセス不可
		if (!userId) {
			return { allowed: false, error: 'Authentication required for this sheet' };
		}

		// 2. user_readに該当ユーザーIDが含まれている場合
		if (user_read && Array.isArray(user_read) && user_read.includes(userId)) {
			return { allowed: true };
		}

		// 3. role_readに該当ユーザーのロールが含まれている場合
		if (role_read && Array.isArray(role_read) && userRoles) {
			const hasRequiredRole = userRoles.some(role => role_read.includes(role));
			if (hasRequiredRole) {
				return { allowed: true };
			}
		}

		return { allowed: false, error: 'No read permission for this sheet' };
	} catch (error) {
		console.error('Error checking sheet read permission:', error);
		return { allowed: false, error: 'Failed to check permissions' };
	}
}

// シート情報を取得するヘルパー関数（シートIDまたはシート名で検索）
async function getSheetInfo(
	sheetIdOrName: string,
	spreadsheetId: string,
	accessToken: string
): Promise<{ sheetName?: string; sheetId?: number; columns?: Record<string, string>; metadata?: any; error?: string }> {
	try {
		// スプレッドシートのメタデータを取得してシート名を確認
		const metadataResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				}
			}
		);

		if (!metadataResponse.ok) {
			return { error: 'Failed to fetch spreadsheet metadata' };
		}

		const metadata = await metadataResponse.json() as any;
		
		// シートIDまたはシート名で検索
		let sheet;
		const isNumeric = /^\d+$/.test(sheetIdOrName);
		
		if (isNumeric) {
			// 数値の場合はシートIDとして検索
			sheet = metadata.sheets?.find((s: any) => s.properties.sheetId.toString() === sheetIdOrName);
		} else {
			// 文字列の場合はシート名として検索
			sheet = metadata.sheets?.find((s: any) => s.properties.title === sheetIdOrName);
		}
		
		if (!sheet) {
			return { error: 'Sheet not found' };
		}

		const sheetName = sheet.properties.title;
		const sheetId = sheet.properties.sheetId;

		// シートの列情報を取得（1行目：ヘッダー、2行目：型定義）
		const valuesResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:ZZ2`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				}
			}
		);

		if (!valuesResponse.ok) {
			return { error: 'Failed to fetch sheet data' };
		}

		const valuesData = await valuesResponse.json() as any;
		const rows = valuesData.values || [];
		
		if (rows.length < 2) {
			return { error: 'Invalid sheet structure' };
		}

		const headers = rows[0] || [];
		const types = rows[1] || [];
		
		// 列名と型のマッピングを作成
		const columns: Record<string, string> = {};
		for (let i = 0; i < headers.length; i++) {
			if (headers[i] && types[i]) {
				columns[headers[i]] = types[i];
			}
		}

		// シートの最初のデータ行からメタデータを取得（3行目以降）
		const dataResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A3:ZZ3`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				}
			}
		);

		let sheetMetadata: any = {
			public_read: true,
			public_write: false,
			role_read: [],
			role_write: [],
			user_read: [],
			user_write: []
		};

		if (dataResponse.ok) {
			const dataResult = await dataResponse.json() as any;
			const dataRows = dataResult.values || [];
			
			if (dataRows.length > 0 && dataRows[0]) {
				const dataRow = dataRows[0];
				// データ行から権限情報を取得（各列の順序に従って）
				const headerIndexes: Record<string, number> = {};
				headers.forEach((header: string, index: number) => {
					headerIndexes[header] = index;
				});

				if (headerIndexes['public_read'] !== undefined && dataRow[headerIndexes['public_read']]) {
					sheetMetadata.public_read = dataRow[headerIndexes['public_read']].toLowerCase() === 'true';
				}
				if (headerIndexes['public_write'] !== undefined && dataRow[headerIndexes['public_write']]) {
					sheetMetadata.public_write = dataRow[headerIndexes['public_write']].toLowerCase() === 'true';
				}
				if (headerIndexes['role_read'] !== undefined && dataRow[headerIndexes['role_read']]) {
					try {
						sheetMetadata.role_read = JSON.parse(dataRow[headerIndexes['role_read']]);
					} catch (e) {
						sheetMetadata.role_read = [];
					}
				}
				if (headerIndexes['role_write'] !== undefined && dataRow[headerIndexes['role_write']]) {
					try {
						sheetMetadata.role_write = JSON.parse(dataRow[headerIndexes['role_write']]);
					} catch (e) {
						sheetMetadata.role_write = [];
					}
				}
				if (headerIndexes['user_read'] !== undefined && dataRow[headerIndexes['user_read']]) {
					try {
						sheetMetadata.user_read = JSON.parse(dataRow[headerIndexes['user_read']]);
					} catch (e) {
						sheetMetadata.user_read = [];
					}
				}
				if (headerIndexes['user_write'] !== undefined && dataRow[headerIndexes['user_write']]) {
					try {
						sheetMetadata.user_write = JSON.parse(dataRow[headerIndexes['user_write']]);
					} catch (e) {
						sheetMetadata.user_write = [];
					}
				}
			}
		}

		return { sheetName, sheetId, columns, metadata: sheetMetadata };
	} catch (error) {
		console.error('Error getting sheet info:', error);
		return { error: 'Failed to get sheet information' };
	}
}

// 新しいシートを作成するヘルパー関数
async function createGoogleSheet(
	sheetName: string,
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; sheetId?: number; error?: string }> {
	try {
		// Define default columns for new sheets
		// These are the core system columns required for sheet functionality
		// Note: 'name' column was removed (previously at index 1) to allow more flexible sheet structures
		const defaultColumns = [
			'id', 'created_at', 'updated_at', 'public_read', 'public_write', 
			'role_read', 'role_write', 'user_read', 'user_write'
		];
		
		// Define the data types for each default column
		// These correspond to the columns above in the same order
		const defaultColumnTypes = [
			'string', 'datetime', 'datetime', 'boolean', 'boolean',
			'array', 'array', 'array', 'array'
		];

		// 全カラム名と型を結合
		const allColumnNames = [...defaultColumns];
		const allColumnTypes = [...defaultColumnTypes];

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

// シートを更新するヘルパー関数
async function updateGoogleSheet(
	sheetId: string,
	sheetName: string,
	updateData: any,
	currentMetadata: any,
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; updatedMetadata?: any; error?: string }> {
	try {
		let requests: any[] = [];
		const newSheetName = updateData.name || sheetName;

		// シート名の変更
		if (updateData.name && updateData.name !== sheetName) {
			requests.push({
				updateSheetProperties: {
					properties: {
						sheetId: parseInt(sheetId),
						title: updateData.name
					},
					fields: 'title'
				}
			});
		}

		// 更新されたメタデータを作成
		const updatedMetadata = {
			public_read: updateData.public_read !== undefined ? updateData.public_read : currentMetadata.public_read,
			public_write: updateData.public_write !== undefined ? updateData.public_write : currentMetadata.public_write,
			role_read: updateData.role_read !== undefined ? updateData.role_read : currentMetadata.role_read,
			role_write: updateData.role_write !== undefined ? updateData.role_write : currentMetadata.role_write,
			user_read: updateData.user_read !== undefined ? updateData.user_read : currentMetadata.user_read,
			user_write: updateData.user_write !== undefined ? updateData.user_write : currentMetadata.user_write
		};

		// 権限データを3行目の適切な位置に更新
		// まず列のヘッダー情報を取得
		const headersResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${newSheetName}!A1:ZZ1`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				}
			}
		);

		if (headersResponse.ok) {
			const headersData = await headersResponse.json() as any;
			const headers = headersData.values?.[0] || [];
			
			// ヘッダーのインデックスマップを作成
			const headerIndexes: Record<string, number> = {};
			headers.forEach((header: string, index: number) => {
				headerIndexes[header] = index;
			});

			// 3行目のデータを更新
			const rowData: string[] = new Array(headers.length).fill('');
			
			// 各権限フィールドを適切な位置に設定
			if (headerIndexes['public_read'] !== undefined) {
				rowData[headerIndexes['public_read']] = updatedMetadata.public_read.toString();
			}
			if (headerIndexes['public_write'] !== undefined) {
				rowData[headerIndexes['public_write']] = updatedMetadata.public_write.toString();
			}
			if (headerIndexes['role_read'] !== undefined) {
				rowData[headerIndexes['role_read']] = JSON.stringify(updatedMetadata.role_read);
			}
			if (headerIndexes['role_write'] !== undefined) {
				rowData[headerIndexes['role_write']] = JSON.stringify(updatedMetadata.role_write);
			}
			if (headerIndexes['user_read'] !== undefined) {
				rowData[headerIndexes['user_read']] = JSON.stringify(updatedMetadata.user_read);
			}
			if (headerIndexes['user_write'] !== undefined) {
				rowData[headerIndexes['user_write']] = JSON.stringify(updatedMetadata.user_write);
			}

			// セルの更新をリクエストに追加
			requests.push({
				updateCells: {
					range: {
						sheetId: parseInt(sheetId),
						startRowIndex: 2, // 3行目（0ベースで2）
						endRowIndex: 3,
						startColumnIndex: 0,
						endColumnIndex: rowData.length
					},
					rows: [{
						values: rowData.map(value => ({
							userEnteredValue: { stringValue: value }
						}))
					}],
					fields: 'userEnteredValue'
				}
			});
		}

		// すべての更新をバッチで実行
		if (requests.length > 0) {
			const batchUpdateResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
				{
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ requests })
				}
			);

			if (!batchUpdateResponse.ok) {
				const errorText = await batchUpdateResponse.text();
				console.error('Failed to update sheet:', batchUpdateResponse.status, errorText);
				return { success: false, error: `Failed to update sheet: ${batchUpdateResponse.status}` };
			}
		}

		console.log('Sheet updated successfully:', sheetId);
		return { success: true, updatedMetadata };
	} catch (error) {
		console.error('Error updating Google sheet:', error);
		return { success: false, error: 'Failed to update sheet' };
	}
}

// Convert column number to Excel-style letter (A, B, ..., Z, AA, AB, ...)
function getColumnLetter(columnNumber: number): string {
	let letter = '';
	while (columnNumber > 0) {
		const remainder = (columnNumber - 1) % 26;
		letter = String.fromCharCode(65 + remainder) + letter;
		columnNumber = Math.floor((columnNumber - 1) / 26);
	}
	return letter;
}

// シートに列を追加するヘルパー関数
async function addColumnsToGoogleSheet(
	sheetId: string,
	sheetName: string,
	newColumns: Record<string, any>,
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; addedColumns?: Array<{ name: string; type: string; [key: string]: any }>; error?: string }> {
	try {
		// 現在のシートの列情報を取得
		const headersResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:ZZ2`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				}
			}
		);

		if (!headersResponse.ok) {
			return { success: false, error: 'Failed to fetch current sheet structure' };
		}

		const headersData = await headersResponse.json() as any;
		const rows = headersData.values || [];
		
		if (rows.length < 2) {
			return { success: false, error: 'Invalid sheet structure - missing header or type rows' };
		}

		const currentHeaders = rows[0] || [];
		const currentTypes = rows[1] || [];

		// 既存の列名をチェック
		const existingColumns = new Set(currentHeaders.filter(h => h && h.trim()));
		const newColumnNames = Object.keys(newColumns);
		
		// 重複チェック
		const duplicateColumns = newColumnNames.filter(name => existingColumns.has(name));
		if (duplicateColumns.length > 0) {
			return { success: false, error: `Column(s) already exist: ${duplicateColumns.join(', ')}` };
		}

		// 新しい列のヘッダーと型を準備
		const newHeaders = [...currentHeaders, ...newColumnNames];
		const newTypes = [...currentTypes, ...newColumnNames.map(name => {
			if (!newColumns[name].type) {
				throw new Error(`Column '${name}' is missing required 'type' property`);
			}
			return newColumns[name].type;
		})];

		// ヘッダー行を更新
		const headerUpdateResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:${getColumnLetter(newHeaders.length)}1?valueInputOption=RAW`,
			{
				method: 'PUT',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					values: [newHeaders]
				})
			}
		);

		if (!headerUpdateResponse.ok) {
			const errorText = await headerUpdateResponse.text();
			console.error('Failed to update headers:', headerUpdateResponse.status, errorText);
			return { success: false, error: `Failed to update headers: ${headerUpdateResponse.status}` };
		}

		// 型行を更新
		const typeUpdateResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A2:${getColumnLetter(newTypes.length)}2?valueInputOption=RAW`,
			{
				method: 'PUT',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					values: [newTypes]
				})
			}
		);

		if (!typeUpdateResponse.ok) {
			const errorText = await typeUpdateResponse.text();
			console.error('Failed to update types:', typeUpdateResponse.status, errorText);
			return { success: false, error: `Failed to update types: ${typeUpdateResponse.status}` };
		}

		// 追加された列の情報を準備
		const addedColumns = newColumnNames.map(name => ({
			name,
			type: newColumns[name].type,
			...Object.fromEntries(
				Object.entries(newColumns[name]).filter(([key, value]) => key !== 'type' && value !== undefined)
			)
		}));

		console.log('Columns added successfully:', newColumnNames);
		return { success: true, addedColumns };
	} catch (error) {
		console.error('Error adding columns to Google sheet:', error);
		return { success: false, error: 'Failed to add columns to sheet' };
	}
}

// Modify a column in a Google Sheet
async function modifyColumnInGoogleSheet(
	sheetId: string,
	sheetName: string,
	columnId: string,
	modifyData: any,
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; modifiedColumn?: any; error?: string }> {
	try {
		// Get current sheet structure
		const headersResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:ZZ2`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				}
			}
		);

		if (!headersResponse.ok) {
			return { success: false, error: 'Failed to fetch current sheet structure' };
		}

		const headersData = await headersResponse.json() as any;
		const rows = headersData.values || [];
		
		if (rows.length < 2) {
			return { success: false, error: 'Invalid sheet structure - missing header or type rows' };
		}

		const currentHeaders = rows[0] || [];
		const currentTypes = rows[1] || [];

		// Find column by ID (treat as column name for now)
		const columnIndex = currentHeaders.findIndex((header: string) => header === columnId);
		if (columnIndex === -1) {
			return { success: false, error: `Column '${columnId}' not found` };
		}

		const currentType = currentTypes[columnIndex];
		if (!currentType) {
			return { success: false, error: `Column '${columnId}' has no type defined` };
		}

		// Validate that type is not being changed
		if (modifyData.type && modifyData.type !== currentType) {
			return { success: false, error: 'Type changes are not allowed' };
		}

		// If name is being changed, check for conflicts
		if (modifyData.name && modifyData.name !== columnId) {
			const nameExists = currentHeaders.some((header: string, index: number) => 
				header === modifyData.name && index !== columnIndex
			);
			if (nameExists) {
				return { success: false, error: `Column name '${modifyData.name}' already exists` };
			}
		}

		// Update column name if provided
		if (modifyData.name && modifyData.name !== columnId) {
			const newHeaders = [...currentHeaders];
			newHeaders[columnIndex] = modifyData.name;

			const headerUpdateResponse = await fetch(
				`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:${getColumnLetter(newHeaders.length)}1?valueInputOption=RAW`,
				{
					method: 'PUT',
					headers: {
						'Authorization': `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						values: [newHeaders]
					})
				}
			);

			if (!headerUpdateResponse.ok) {
				const errorText = await headerUpdateResponse.text();
				console.error('Failed to update column name:', headerUpdateResponse.status, errorText);
				return { success: false, error: `Failed to update column name: ${headerUpdateResponse.status}` };
			}
		}

		// Create response object with modified column information
		const modifiedColumn = {
			name: modifyData.name || columnId,
			type: currentType,
			...Object.fromEntries(
				Object.entries(modifyData).filter(([key, value]) => 
					key !== 'name' && key !== 'type' && value !== undefined
				)
			)
		};

		console.log('Column modified successfully:', columnId, 'to', modifyData.name || columnId);
		return { success: true, modifiedColumn };
	} catch (error) {
		console.error('Error modifying column in Google sheet:', error);
		return { success: false, error: 'Failed to modify column in sheet' };
	}
}

// シートを削除するヘルパー関数
async function deleteGoogleSheet(
	sheetId: string,
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// シートを削除
		const deleteResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
			{
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					requests: [{
						deleteSheet: {
							sheetId: parseInt(sheetId)
						}
					}]
				})
			}
		);

		if (!deleteResponse.ok) {
			const errorText = await deleteResponse.text();
			console.error('Failed to delete sheet:', deleteResponse.status, errorText);
			return { success: false, error: `Failed to delete sheet: ${deleteResponse.status}` };
		}

		console.log('Sheet deleted successfully:', sheetId);
		return { success: true };
	} catch (error) {
		console.error('Error deleting Google sheet:', error);
		return { success: false, error: 'Failed to delete sheet' };
	}
}

// Sheet management endpoints
export function registerSheetRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
	// GET /api/sheets - シート一覧を取得 (OpenAPI)
	app.openapi(getSheetsRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
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
			
			// スプレッドシートのメタデータを取得してシート一覧を取得
			try {
				const metadataResponse = await fetch(
					`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
					{
						headers: {
							'Authorization': `Bearer ${tokens.access_token}`,
							'Content-Type': 'application/json',
						}
					}
				);

				if (!metadataResponse.ok) {
					return c.json({ success: false as false, error: 'Failed to fetch spreadsheet metadata' }, 500);
				}

				const metadata = await metadataResponse.json() as any;
				const sheets = metadata.sheets || [];
				
				// システムシート（_で始まるシート）を除外してシート一覧を作成
				const sheetList = sheets
					.filter((sheet: any) => !sheet.properties.title.startsWith('_'))
					.map((sheet: any) => ({
						sheetId: sheet.properties.sheetId,
						name: sheet.properties.title
					}));
				
				console.log('Sheets retrieved successfully:', sheetList.length);
				
				// 成功レスポンスを返す
				return c.json({
					success: true as true,
					data: {
						sheets: sheetList
					}
				});
				
			} catch (error) {
				console.error('Error fetching sheets:', error);
				return c.json({ success: false as false, error: 'Failed to fetch sheet list' }, 500);
			}
			
		} catch (error) {
			console.error('Error in GET /api/sheets:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as false, error: errorMessage }, 500);
		}
	});

	// POST /api/sheets - 新しいシートを作成 (OpenAPI)
	app.openapi(createSheetRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
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
			const { name, public_read, public_write, role_read, role_write, user_read, user_write } = requestData;
			
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
			
			// user_writeのデフォルト値を設定（作成したユーザIDを含む）
			const finalUserWrite = user_write.length > 0 ? user_write : [userId];
			
			// 新しいシートを作成
			const createResult = await createGoogleSheet(
				name,
				spreadsheetId,
				tokens.access_token
			);
			
			if (!createResult.success) {
				return c.json({ 
					success: false as false, 
					error: createResult.error || 'Failed to create sheet' 
				}, 500);
			}
			
			console.log('Sheet created successfully:', name);
			
			// 成功レスポンスを返す
			return c.json({
				success: true as true,
				data: {
					name,
					sheetId: createResult.sheetId!,
					public_read,
					public_write,
					role_read,
					role_write,
					user_read,
					user_write: finalUserWrite,
					message: `Sheet '${name}' created successfully with default columns`
				}
			});
			
		} catch (error) {
			console.error('Error in POST /api/sheets:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as false, error: errorMessage }, 500);
		}
	});

	// PUT /api/sheets/:id - シートを更新 (OpenAPI)
	app.openapi(updateSheetRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
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
			
			const { id: sheetId } = c.req.valid('param');
			const updateData = c.req.valid('json');
			
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
			
			// 現在のシート情報を取得
			const sheetInfo = await getSheetInfo(sheetId, spreadsheetId, tokens.access_token);
			if (sheetInfo.error) {
				if (sheetInfo.error === 'Sheet not found') {
					return c.json({ success: false as false, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as false, error: sheetInfo.error }, 500);
			}
			
			const { sheetName, sheetId: actualSheetId, metadata } = sheetInfo;
			if (!sheetName || !actualSheetId || !metadata) {
				return c.json({ success: false as false, error: 'Failed to get sheet information' }, 500);
			}
			
			// シート更新権限をチェック
			const permissionCheck = await checkSheetUpdatePermission(
				userId,
				user.roles || [],
				metadata
			);
			
			if (!permissionCheck.allowed) {
				return c.json({ 
					success: false as false, 
					error: permissionCheck.error || 'Permission denied' 
				}, 403);
			}
			
			// シートを更新
			const updateResult = await updateGoogleSheet(
				actualSheetId.toString(),
				sheetName,
				updateData,
				metadata,
				spreadsheetId,
				tokens.access_token
			);
			
			if (!updateResult.success) {
				return c.json({ 
					success: false as false, 
					error: updateResult.error || 'Failed to update sheet' 
				}, 500);
			}
			
			console.log('Sheet updated successfully:', sheetId);
			
			const finalMetadata = updateResult.updatedMetadata || metadata;
			
			// 成功レスポンスを返す
			return c.json({
				success: true as true,
				data: {
					name: updateData.name || sheetName,
					sheetId: actualSheetId,
					public_read: finalMetadata.public_read,
					public_write: finalMetadata.public_write,
					role_read: finalMetadata.role_read,
					role_write: finalMetadata.role_write,
					user_read: finalMetadata.user_read,
					user_write: finalMetadata.user_write,
					message: `Sheet '${updateData.name || sheetName}' updated successfully`
				}
			});
			
		} catch (error) {
			console.error('Error in PUT /api/sheets/:id:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as false, error: errorMessage }, 500);
		}
	});

	// DELETE /api/sheets/:id - シートを削除 (OpenAPI)
	app.openapi(deleteSheetRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
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
			
			const { id: sheetId } = c.req.valid('param');
			
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
			
			// 現在のシート情報を取得
			const sheetInfo = await getSheetInfo(sheetId, spreadsheetId, tokens.access_token);
			if (sheetInfo.error) {
				if (sheetInfo.error === 'Sheet not found') {
					return c.json({ success: false as false, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as false, error: sheetInfo.error }, 500);
			}
			
			const { sheetName, sheetId: actualSheetId, metadata } = sheetInfo;
			if (!sheetName || !actualSheetId || !metadata) {
				return c.json({ success: false as false, error: 'Failed to get sheet information' }, 500);
			}
			
			// シート削除権限をチェック（更新権限と同じチェック）
			const permissionCheck = await checkSheetUpdatePermission(
				userId,
				user.roles || [],
				metadata
			);
			
			if (!permissionCheck.allowed) {
				return c.json({ 
					success: false as false, 
					error: permissionCheck.error || 'Permission denied' 
				}, 403);
			}
			
			// シートを削除
			const deleteResult = await deleteGoogleSheet(
				actualSheetId.toString(),
				spreadsheetId,
				tokens.access_token
			);
			
			if (!deleteResult.success) {
				return c.json({ 
					success: false as false, 
					error: deleteResult.error || 'Failed to delete sheet' 
				}, 500);
			}
			
			console.log('Sheet deleted successfully:', sheetId, sheetName);
			
			// 成功レスポンスを返す
			return c.json({
				success: true as true,
				data: {}
			});
			
		} catch (error) {
			console.error('Error in DELETE /api/sheets/:id:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as false, error: errorMessage }, 500);
		}
	});

	// GET /api/sheets/:id - シートメタデータを取得 (OpenAPI)
	app.openapi(getSheetMetadataRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			const { id: sheetIdOrName } = c.req.valid('param');
			
			// オプション認証の実装
			const authHeader = c.req.header('authorization');
			let userId: string | null = null;
			let userRoles: string[] = [];
			let isAuthenticated = false;
			
			// 認証ヘッダーが提供されている場合のみ認証を試行
			if (authHeader) {
				const sessionId = authHeader.replace('Bearer ', '');
				const authResult = await authenticateSession(db, sessionId);
				if (authResult.valid && authResult.userId) {
					userId = authResult.userId;
					isAuthenticated = true;
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
			
			// 認証されている場合、ユーザー情報を取得
			if (isAuthenticated && userId) {
				const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
				if (user) {
					userRoles = user.roles || [];
				}
			}
			
			// シート情報を取得（IDまたは名前で検索）
			const sheetInfo = await getSheetInfo(sheetIdOrName, spreadsheetId, tokens.access_token);
			if (sheetInfo.error) {
				if (sheetInfo.error === 'Sheet not found') {
					return c.json({ success: false as false, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as false, error: sheetInfo.error }, 500);
			}
			
			const { sheetName, sheetId, columns, metadata } = sheetInfo;
			if (!sheetName || !sheetId || !columns || !metadata) {
				return c.json({ success: false as false, error: 'Failed to get sheet information' }, 500);
			}
			
			// シート読み取り権限をチェック
			const permissionCheck = await checkSheetReadPermission(userId, userRoles, metadata);
			if (!permissionCheck.allowed) {
				if (permissionCheck.error === 'Authentication required for this sheet') {
					return c.json({ success: false as false, error: permissionCheck.error }, 401);
				}
				return c.json({ success: false as false, error: permissionCheck.error || 'Permission denied' }, 403);
			}
			
			// カラム情報を変換（名前、型、必須フラグ）
			const formattedColumns = Object.entries(columns).map(([name, type]) => ({
				name,
				type: type as 'string' | 'number' | 'datetime' | 'boolean' | 'pointer' | 'array' | 'object',
				required: ['id', 'created_at', 'updated_at'].includes(name) // デフォルトで必須フィールドを設定
			}));
			
			console.log('Sheet metadata retrieved successfully:', sheetIdOrName, sheetName, sheetId);
			
			// 成功レスポンスを返す
			return c.json({
				success: true as true,
				data: {
					sheetId: sheetId,
					name: sheetName,
					columns: formattedColumns,
					public_read: metadata.public_read,
					public_write: metadata.public_write,
					role_read: metadata.role_read,
					role_write: metadata.role_write,
					user_read: metadata.user_read,
					user_write: metadata.user_write
				}
			});
			
		} catch (error) {
			console.error('Error in GET /api/sheets/:id:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as false, error: errorMessage }, 500);
		}
	});

	// POST /api/sheets/:id/columns - シートに列を追加 (OpenAPI)
	app.openapi(addColumnsRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
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
			
			const { id: sheetId } = c.req.valid('param');
			const newColumns = c.req.valid('json');
			
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
			
			// シート情報を取得
			const sheetInfo = await getSheetInfo(sheetId, spreadsheetId, tokens.access_token);
			if (sheetInfo.error) {
				if (sheetInfo.error === 'Sheet not found') {
					return c.json({ success: false as false, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as false, error: sheetInfo.error }, 500);
			}
			
			const { sheetName, sheetId: actualSheetId, metadata } = sheetInfo;
			if (!sheetName || !actualSheetId || !metadata) {
				return c.json({ success: false as false, error: 'Failed to get sheet information' }, 500);
			}
			
			// Check column modification permission
			const permissionCheck = await checkColumnModifyPermission(
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
			
			// 列をシートに追加
			const addResult = await addColumnsToGoogleSheet(
				actualSheetId.toString(),
				sheetName,
				newColumns,
				spreadsheetId,
				tokens.access_token
			);
			
			if (!addResult.success) {
				if (addResult.error?.includes('already exist')) {
					return c.json({ 
						success: false as false, 
						error: addResult.error 
					}, 400);
				}
				return c.json({ 
					success: false as false, 
					error: addResult.error || 'Failed to add columns' 
				}, 500);
			}
			
			console.log('Columns added successfully to sheet:', sheetId, sheetName);
			
			// 成功レスポンスを返す
			return c.json({
				success: true as true,
				data: {
					sheetId: actualSheetId,
					name: sheetName,
					addedColumns: addResult.addedColumns || [],
					message: `Successfully added ${addResult.addedColumns?.length || 0} column(s) to sheet '${sheetName}'`
				}
			});
			
		} catch (error) {
			console.error('Error in POST /api/sheets/:id/columns:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as false, error: errorMessage }, 500);
		}
	});

	// PUT /api/sheets/:id/columns/:columnId - Modify a column in a sheet (OpenAPI)
	app.openapi(modifyColumnRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
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
			
			const { id: sheetId, columnId } = c.req.valid('param');
			const modifyData = c.req.valid('json');
			
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
			
			// シート情報を取得
			const sheetInfo = await getSheetInfo(sheetId, spreadsheetId, tokens.access_token);
			if (sheetInfo.error) {
				if (sheetInfo.error === 'Sheet not found') {
					return c.json({ success: false as false, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as false, error: sheetInfo.error }, 500);
			}
			
			const { sheetName, sheetId: actualSheetId } = sheetInfo;
			if (!sheetName || !actualSheetId) {
				return c.json({ success: false as false, error: 'Failed to get sheet information' }, 500);
			}
			
			// Check column modification permission
			const permissionCheck = await checkColumnModifyPermission(
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
			
			// Modify the column
			const modifyResult = await modifyColumnInGoogleSheet(
				actualSheetId.toString(),
				sheetName,
				columnId,
				modifyData,
				spreadsheetId,
				tokens.access_token
			);
			
			if (!modifyResult.success) {
				if (modifyResult.error?.includes('not found')) {
					return c.json({ 
						success: false as false, 
						error: modifyResult.error 
					}, 404);
				}
				if (modifyResult.error?.includes('Type changes are not allowed') || 
					modifyResult.error?.includes('already exists')) {
					return c.json({ 
						success: false as false, 
						error: modifyResult.error 
					}, 400);
				}
				return c.json({ 
					success: false as false, 
					error: modifyResult.error || 'Failed to modify column' 
				}, 500);
			}
			
			console.log('Column modified successfully in sheet:', sheetId, sheetName, columnId);
			
			// 成功レスポンスを返す
			return c.json({
				success: true as true,
				data: {
					sheetId: actualSheetId,
					name: sheetName,
					columnId: modifyResult.modifiedColumn?.name || columnId,
					modifiedColumn: modifyResult.modifiedColumn || {},
					message: `Successfully modified column '${columnId}' in sheet '${sheetName}'`
				}
			});
			
		} catch (error) {
			console.error('Error in PUT /api/sheets/:id/columns/:columnId:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as false, error: errorMessage }, 500);
		}
	});
}