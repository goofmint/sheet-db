import { OpenAPIHono } from '@hono/zod-openapi';
import { logger } from '../utils/logger';
import { dataInsertionRateLimiter, unauthenticatedRateLimiter } from '../utils/rate-limiter';
import { sheetDataValidator } from '../utils/data-validator';
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
import { getSheetsRoute, createSheetRoute, updateSheetRoute, deleteSheetRoute, getSheetMetadataRoute, addColumnsRoute, deleteColumnRoute, updateColumnRoute, getColumnInfoRoute, getSheetDataRoute, createSheetDataRoute, updateSheetDataRoute, deleteSheetDataRoute } from '../api-routes';
import { authenticateSession } from './auth';
import { getMultipleConfigsFromSheet, getUserFromSheet } from '../utils/sheet-helpers';

type Bindings = {
	DB: D1Database;
	ASSETS: Fetcher;
};


// Helper function to check sheet creation permissions
async function checkSheetCreationPermission(
	userId: string,
	userRoles: string[],
	spreadsheetId: string,
	accessToken: string
): Promise<{ allowed: boolean; error?: string }> {
	try {
		// Get multiple settings from _Config sheet at once (performance improvement)
		const configs = await getMultipleConfigsFromSheet(
			['CREATE_SHEET_BY_API', 'CREATE_SHEET_USER', 'CREATE_SHEET_ROLE'], 
			spreadsheetId, 
			accessToken
		);
		
		const createSheetByApi = configs['CREATE_SHEET_BY_API'];
		const createSheetUser = configs['CREATE_SHEET_USER'];
		const createSheetRole = configs['CREATE_SHEET_ROLE'];

		// If CREATE_SHEET_BY_API is false, sheet creation via API is prohibited
		if (createSheetByApi === 'false') {
			return { allowed: false, error: 'Sheet creation via API is disabled' };
		}

		// If CREATE_SHEET_USER is set, only specified users can create
		if (createSheetUser && createSheetUser !== '') {
			try {
				const allowedUsers = JSON.parse(createSheetUser);
				if (Array.isArray(allowedUsers) && !allowedUsers.includes(userId)) {
					return { allowed: false, error: 'User not authorized to create sheets' };
				}
			} catch (e) {
				// In case of JSON parsing error, treat as single user ID
				if (createSheetUser !== userId) {
					return { allowed: false, error: 'User not authorized to create sheets' };
				}
			}
		}

		// If CREATE_SHEET_ROLE is set, only users with specified roles can create
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
				// In case of JSON parsing error, treat as single role name
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

// Helper function to check sheet update permissions (check sheet-specific permissions)
async function checkSheetUpdatePermission(
	userId: string,
	userRoles: string[],
	sheetMetadata: any
): Promise<{ allowed: boolean; error?: string }> {
	try {
		// Get permission information from sheet metadata
		const { public_write, role_write, user_write } = sheetMetadata;

		// 1. If public_write = true, anyone can update
		if (public_write === true) {
			return { allowed: true };
		}

		// 2. If the user ID is included in user_write
		if (user_write && Array.isArray(user_write) && user_write.includes(userId)) {
			return { allowed: true };
		}

		// 3. If the user's role is included in role_write
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

// Check sheet write permission for data insertion
async function checkSheetWritePermission(
	userId: string | null,
	userRoles: string[],
	sheetMetadata: any
): Promise<{ allowed: boolean; error?: string }> {
	try {
		// Get permission info from sheet metadata
		const { public_write, role_write, user_write } = sheetMetadata;

		logger.debug('Checking write permission', {
			userId: userId,
			userRoles: userRoles,
			publicWrite: public_write,
			roleWrite: role_write,
			userWrite: user_write
		});

		// 1. public_write = true allows anyone to write
		if (public_write === true) {
			logger.debug('Access granted: public write enabled');
			return { allowed: true };
		}

		// 2. If no specific permissions are set, allow anyone to write (default behavior)
		if (!public_write && !role_write && !user_write) {
			logger.debug('Access granted: no permissions configured');
			return { allowed: true };
		}

		// 3. If permissions are empty arrays, deny access (default-deny security)
		if (public_write !== true && public_write !== false && 
			(Array.isArray(role_write) && role_write.length === 0) && 
			(Array.isArray(user_write) && user_write.length === 0)) {
			logger.debug('Access denied: empty permission arrays (default-deny)');
			return { allowed: false, error: 'No write permissions configured for this sheet' };
		}

		// 4. If public_write is explicitly false, check authenticated user permissions
		if (public_write === false) {
			// Unauthenticated users cannot write if public_write = false
			if (!userId) {
				logger.debug('Access denied: authentication required for private sheet');
				return { allowed: false, error: 'Authentication required for this sheet' };
			}

			// If user_write and role_write are empty arrays, allow authenticated users
			if ((Array.isArray(user_write) && user_write.length === 0) && 
				(Array.isArray(role_write) && role_write.length === 0)) {
				logger.debug('Access granted: authenticated user with empty permission arrays');
				return { allowed: true };
			}

			// Check user_write contains the user ID
			if (user_write && Array.isArray(user_write) && user_write.includes(userId)) {
				logger.debug('Access granted: user in user_write list');
				return { allowed: true };
			}

			// Check role_write contains any of the user's roles
			if (role_write && Array.isArray(role_write) && userRoles) {
				const hasRequiredRole = userRoles.some(role => role_write.includes(role));
				if (hasRequiredRole) {
					logger.debug('Access granted: user has required role');
					return { allowed: true };
				}
			}

			logger.debug('Access denied: no matching permissions for private sheet');
			return { allowed: false, error: 'No write permission for this sheet' };
		}

		// Default deny - no matching permissions found
		logger.debug('Access denied: no matching permissions found');
		return { allowed: false, error: 'No write permission for this sheet' };
	} catch (error) {
		logger.error('Error checking sheet write permission', { error });
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

// Helper function to check sheet read permissions
async function checkSheetReadPermission(
	userId: string | null,
	userRoles: string[],
	sheetMetadata: any
): Promise<{ allowed: boolean; error?: string }> {
	try {
		// Get permission information from sheet metadata
		const { public_read, role_read, user_read } = sheetMetadata;

		// 1. If public_read = true, anyone can read
		if (public_read === true) {
			return { allowed: true };
		}

		// Unauthenticated users cannot access if public_read = false
		if (!userId) {
			return { allowed: false, error: 'Authentication required for this sheet' };
		}

		// 2. If the user ID is included in user_read
		if (user_read && Array.isArray(user_read) && user_read.includes(userId)) {
			return { allowed: true };
		}

		// 3. If the user's role is included in role_read
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

// Helper function to get sheet information (search by sheet ID or sheet name)
async function getSheetInfo(
	sheetIdOrName: string,
	spreadsheetId: string,
	accessToken: string
): Promise<{ sheetName?: string; sheetId?: number; columns?: Record<string, string>; metadata?: any; error?: string }> {
	try {
		// Get spreadsheet metadata to check sheet names
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
		
		// Search by sheet ID or sheet name
		let sheet;
		const isNumeric = /^\d+$/.test(sheetIdOrName);
		
		if (isNumeric) {
			// If numeric, search as sheet ID
			sheet = metadata.sheets?.find((s: any) => s.properties.sheetId.toString() === sheetIdOrName);
		} else {
			// If string, search as sheet name
			sheet = metadata.sheets?.find((s: any) => s.properties.title === sheetIdOrName);
		}
		
		if (!sheet) {
			return { error: 'Sheet not found' };
		}

		const sheetName = sheet.properties.title;
		const sheetId = sheet.properties.sheetId;

		// Get sheet column information (row 1: header, row 2: type definition)
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
		
		// Create mapping of column names and types
		const columns: Record<string, string> = {};
		for (let i = 0; i < headers.length; i++) {
			if (headers[i] && types[i]) {
				columns[headers[i]] = types[i];
			}
		}

		// Get metadata from the first data row of the sheet (row 3 onwards)
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
				// Get permission information from data row (according to column order)
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

// Helper function to create a new sheet
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

		// Combine all column names and types
		const allColumnNames = [...defaultColumns];
		const allColumnTypes = [...defaultColumnTypes];

		// Create new sheet
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
			return { success: false as const, error: `Failed to create sheet: ${createSheetResponse.status}` };
		}

		const createResult = await createSheetResponse.json() as any;
		const sheetId = createResult.replies?.[0]?.addSheet?.properties?.sheetId;

		if (!sheetId) {
			return { success: false as const, error: 'Failed to get new sheet ID' };
		}

		// Set column names in header row (row 1)
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
			return { success: false as const, error: `Failed to set headers: ${headerResponse.status}` };
		}

		// Set type information in type definition row (row 2)
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
			return { success: false as const, error: `Failed to set types: ${typeResponse.status}` };
		}

		// Header row freeze settings (freeze rows 1 and 2 for display)
		const freezeResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
			{
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					requests: [{
						updateSheetProperties: {
							properties: {
								sheetId: sheetId,
								gridProperties: {
									frozenRowCount: 2
								}
							},
							fields: 'gridProperties.frozenRowCount'
						}
					}]
				})
			}
		);

		if (!freezeResponse.ok) {
			const errorText = await freezeResponse.text();
			logger.error('Failed to freeze header rows', { 
				status: freezeResponse.status, 
				error: errorText,
				spreadsheetId: spreadsheetId
			});
			// Return warning in response rather than just logging
			return { 
				success: true, 
				sheetId,
				warning: 'Sheet created but header rows could not be frozen' 
			};
		}

		logger.info('Sheet created successfully', { sheetName, sheetId });
		return { success: true, sheetId };
	} catch (error) {
		logger.error('Error creating Google sheet', { error });
		return { success: false as const, error: 'Failed to create sheet' };
	}
}

// Helper function to update sheet
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

		// Change sheet name
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

		// Create updated metadata
		const updatedMetadata = {
			public_read: updateData.public_read !== undefined ? updateData.public_read : currentMetadata.public_read,
			public_write: updateData.public_write !== undefined ? updateData.public_write : currentMetadata.public_write,
			role_read: updateData.role_read !== undefined ? updateData.role_read : currentMetadata.role_read,
			role_write: updateData.role_write !== undefined ? updateData.role_write : currentMetadata.role_write,
			user_read: updateData.user_read !== undefined ? updateData.user_read : currentMetadata.user_read,
			user_write: updateData.user_write !== undefined ? updateData.user_write : currentMetadata.user_write
		};

		// Update permission data to appropriate positions in row 3
		// First get column header information
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
			
			// Create header index map
			const headerIndexes: Record<string, number> = {};
			headers.forEach((header: string, index: number) => {
				headerIndexes[header] = index;
			});

			// Update row 3 data
			const rowData: string[] = new Array(headers.length).fill('');
			
			// Set each permission field to appropriate position
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

			// Add cell update to request
			requests.push({
				updateCells: {
					range: {
						sheetId: parseInt(sheetId),
						startRowIndex: 2, // Row 3 (0-based index 2)
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

		// Execute all updates in batch
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
				return { success: false as const, error: `Failed to update sheet: ${batchUpdateResponse.status}` };
			}
		}

		console.log('Sheet updated successfully:', sheetId);
		return { success: true, updatedMetadata };
	} catch (error) {
		console.error('Error updating Google sheet:', error);
		return { success: false as const, error: 'Failed to update sheet' };
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

// Helper function to add columns to sheet
async function addColumnsToGoogleSheet(
	sheetId: string,
	sheetName: string,
	newColumns: Record<string, any>,
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; addedColumns?: Array<{ name: string; type: string; [key: string]: any }>; error?: string }> {
	try {
		// Get current sheet column information
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
			return { success: false as const, error: 'Failed to fetch current sheet structure' };
		}

		const headersData = await headersResponse.json() as any;
		const rows = headersData.values || [];
		
		if (rows.length < 2) {
			return { success: false as const, error: 'Invalid sheet structure - missing header or type rows' };
		}

		const currentHeaders = rows[0] || [];
		const currentTypes = rows[1] || [];

		// Check existing column names
		const existingColumns = new Set(currentHeaders.filter(h => h && h.trim()));
		const newColumnNames = Object.keys(newColumns);
		
		// Check for duplicates
		const duplicateColumns = newColumnNames.filter(name => existingColumns.has(name));
		if (duplicateColumns.length > 0) {
			return { success: false as const, error: `Column(s) already exist: ${duplicateColumns.join(', ')}` };
		}

		// Prepare new column headers and types
		const newHeaders = [...currentHeaders, ...newColumnNames];
		const newTypes = [...currentTypes, ...newColumnNames.map(name => {
			if (!newColumns[name].type) {
				throw new Error(`Column '${name}' is missing required 'type' property`);
			}
			return newColumns[name].type;
		})];

		// Update header row
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
			return { success: false as const, error: `Failed to update headers: ${headerUpdateResponse.status}` };
		}

		// Update type row
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
			return { success: false as const, error: `Failed to update types: ${typeUpdateResponse.status}` };
		}

		// Prepare information for added columns
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
		return { success: false as const, error: 'Failed to add columns to sheet' };
	}
}

// Update a column's metadata in a Google Sheet
async function updateColumnInGoogleSheet(
	sheetId: string,
	sheetName: string,
	columnName: string,
	updateData: {
		name?: string;
		pattern?: string;
		minLength?: number;
		maxLength?: number;
		min?: number;
		max?: number;
		default?: string | number | boolean | null;
	},
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; updatedColumn?: any; error?: string }> {
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
			return { success: false as const, error: 'Failed to fetch current sheet structure' };
		}

		const headersData = await headersResponse.json() as any;
		const rows = headersData.values || [];
		
		if (rows.length < 2) {
			return { success: false as const, error: 'Invalid sheet structure - missing header or type rows' };
		}

		const currentHeaders = rows[0] || [];
		const currentTypes = rows[1] || [];

		// Find the column index
		const columnIndex = currentHeaders.findIndex((header: string) => header === columnName);
		if (columnIndex === -1) {
			return { success: false as const, error: 'Column not found' };
		}

		// Check if this is a system column that cannot be modified
		const systemColumns = ['id', 'created_at', 'updated_at', 'public_read', 'public_write', 'role_read', 'role_write', 'user_read', 'user_write'];
		if (systemColumns.includes(columnName)) {
			return { success: false as const, error: 'System columns cannot be modified' };
		}

		// Get the current column type
		const currentType = currentTypes[columnIndex];
		if (!currentType) {
			return { success: false as const, error: 'Column type not found' };
		}

		// Parse current type definition to get existing metadata
		const { parseColumnSchema } = await import('../utils/schema-parser');
		const currentSchema = parseColumnSchema(currentType);
		
		// Merge existing metadata with new metadata (only non-undefined values)
		const updatedSchema = {
			...currentSchema,
			...(updateData.pattern !== undefined && { pattern: updateData.pattern }),
			...(updateData.minLength !== undefined && { minLength: updateData.minLength }),
			...(updateData.maxLength !== undefined && { maxLength: updateData.maxLength }),
			...(updateData.min !== undefined && { min: updateData.min }),
			...(updateData.max !== undefined && { max: updateData.max }),
			...(updateData.default !== undefined && { default: updateData.default })
		};

		// Update column name if provided
		if (updateData.name && updateData.name !== columnName) {
			// Check if new name already exists
			const existingColumnIndex = currentHeaders.findIndex((header: string) => header === updateData.name);
			if (existingColumnIndex !== -1 && existingColumnIndex !== columnIndex) {
				return { success: false as const, error: 'Column name already exists' };
			}

			// Update header
			const newHeaders = [...currentHeaders];
			newHeaders[columnIndex] = updateData.name;
			
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
				return { success: false as const, error: `Failed to update headers: ${headerUpdateResponse.status}` };
			}
		}

		// Update type definition in row 2 with new metadata
		const hasMetadata = updatedSchema.pattern || updatedSchema.minLength !== undefined || 
			updatedSchema.maxLength !== undefined || updatedSchema.min !== undefined || 
			updatedSchema.max !== undefined || updatedSchema.default !== undefined || 
			updatedSchema.required !== undefined || updatedSchema.unique !== undefined;

		let typeDefinition: string;
		if (hasMetadata) {
			// Store as JSON object with full metadata
			typeDefinition = JSON.stringify(updatedSchema);
		} else {
			// Store as simple type string
			typeDefinition = updatedSchema.type;
		}

		const newTypes = [...currentTypes];
		newTypes[columnIndex] = typeDefinition;

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
			return { success: false as const, error: `Failed to update types: ${typeUpdateResponse.status}` };
		}
		
		const updatedColumn = {
			name: updateData.name || columnName,
			type: updatedSchema.type,
			pattern: updatedSchema.pattern,
			minLength: updatedSchema.minLength,
			maxLength: updatedSchema.maxLength,
			min: updatedSchema.min,
			max: updatedSchema.max,
			default: updatedSchema.default
		};

		console.log('Column updated successfully:', updateData.name || columnName);
		return { success: true, updatedColumn };
	} catch (error) {
		console.error('Error updating column in Google sheet:', error);
		return { success: false as const, error: 'Failed to update column in sheet' };
	}
}

// Delete or clear a column from a Google Sheet
async function deleteColumnFromGoogleSheet(
	sheetId: string,
	sheetName: string,
	columnName: string,
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; action?: 'deleted' | 'cleared'; error?: string }> {
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
			return { success: false as const, error: 'Failed to fetch current sheet structure' };
		}

		const headersData = await headersResponse.json() as any;
		const rows = headersData.values || [];
		
		if (rows.length < 2) {
			return { success: false as const, error: 'Invalid sheet structure - missing header or type rows' };
		}

		const currentHeaders = rows[0] || [];
		const currentTypes = rows[1] || [];

		// Find the column index
		const columnIndex = currentHeaders.findIndex((header: string) => header === columnName);
		if (columnIndex === -1) {
			return { success: false as const, error: 'Column not found' };
		}

		// Check if this is a system column that cannot be deleted
		const systemColumns = ['id', 'created_at', 'updated_at', 'public_read', 'public_write', 'role_read', 'role_write', 'user_read', 'user_write'];
		if (systemColumns.includes(columnName)) {
			return { success: false as const, error: 'System columns cannot be deleted' };
		}

		// For safety, we'll clear the column data instead of deleting the column entirely
		// This prevents data misalignment issues during concurrent operations
		const columnLetter = getColumnLetter(columnIndex + 1);
		
		// Clear the column data (header and type rows will be cleared too, then restored)
		const clearResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!${columnLetter}:${columnLetter}:clear`,
			{
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				}
			}
		);

		if (!clearResponse.ok) {
			const errorText = await clearResponse.text();
			console.error('Failed to clear column data:', clearResponse.status, errorText);
			return { success: false as const, error: `Failed to clear column data: ${clearResponse.status}` };
		}

		// Update headers to remove the column name
		const newHeaders = currentHeaders.filter((_: string, index: number) => index !== columnIndex);
		const newTypes = currentTypes.filter((_: string, index: number) => index !== columnIndex);

		// Update header row
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
			return { success: false as const, error: `Failed to update headers: ${headerUpdateResponse.status}` };
		}

		// Update type row
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
			return { success: false as const, error: `Failed to update types: ${typeUpdateResponse.status}` };
		}

		console.log('Column cleared successfully:', columnName);
		return { success: true, action: 'cleared' };
	} catch (error) {
		console.error('Error deleting column from Google sheet:', error);
		return { success: false as const, error: 'Failed to delete column from sheet' };
	}
}

// Helper function to delete sheet
async function deleteGoogleSheet(
	sheetId: string,
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// Delete sheet
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
			return { success: false as const, error: `Failed to delete sheet: ${deleteResponse.status}` };
		}

		console.log('Sheet deleted successfully:', sheetId);
		return { success: true };
	} catch (error) {
		console.error('Error deleting Google sheet:', error);
		return { success: false as const, error: 'Failed to delete sheet' };
	}
}

// Helper function to parse WHERE conditions
function parseWhereCondition(whereStr: string): any {
	try {
		return JSON.parse(whereStr);
	} catch (error) {
		throw new Error('Invalid WHERE condition format');
	}
}

// Helper function to apply WHERE conditions to a row
function matchesWhereCondition(row: Record<string, any>, whereCondition: any): boolean {
	for (const [field, condition] of Object.entries(whereCondition)) {
		const value = row[field];
		
		if (typeof condition === 'object' && condition !== null) {
			// Handle operators
			for (const [operator, expectedValue] of Object.entries(condition)) {
				switch (operator) {
					case '$lt':
						if (!(value < expectedValue)) return false;
						break;
					case '$lte':
						if (!(value <= expectedValue)) return false;
						break;
					case '$gt':
						if (!(value > expectedValue)) return false;
						break;
					case '$gte':
						if (!(value >= expectedValue)) return false;
						break;
					case '$ne':
						if (value === expectedValue) return false;
						break;
					case '$in':
						if (!Array.isArray(expectedValue) || !expectedValue.includes(value)) return false;
						break;
					case '$nin':
						if (!Array.isArray(expectedValue) || expectedValue.includes(value)) return false;
						break;
					case '$exists':
						if (Boolean(expectedValue) !== (value !== undefined && value !== null && value !== '')) return false;
						break;
					case '$regex':
						try {
							const pattern = expectedValue as string;
							
							// Basic pattern complexity check to prevent ReDoS
							// Reject patterns with excessive repetition or nested quantifiers
							const dangerousPatterns = [
								/(\+|\*){2,}/,           // Multiple consecutive quantifiers
								/(\(.*\)){2,}[\+\*]/,    // Nested groups with quantifiers
								/(\[.*\]){2,}[\+\*]/,    // Nested character classes with quantifiers
								/\(\?.*\){3,}/,          // Excessive conditional groups
								/.{100,}/                // Overly long patterns
							];
							
							if (dangerousPatterns.some(dangerous => dangerous.test(pattern))) {
								console.warn('Potentially dangerous regex pattern rejected:', pattern);
								return false;
							}
							
							// Additional check for pattern length
							if (pattern.length > 200) {
								console.warn('Regex pattern too long:', pattern.length);
								return false;
							}
							
							const regex = new RegExp(pattern, 'u'); // Use unicode flag for better safety
							const stringValue = String(value);
							
							// Limit input string length to prevent excessive processing
							if (stringValue.length > 10000) {
								console.warn('Input string too long for regex matching:', stringValue.length);
								return false;
							}
							
							if (!regex.test(stringValue)) return false;
						} catch (e) {
							console.error('Regex error:', e);
							return false;
						}
						break;
					case '$text':
						if (!String(value).toLowerCase().includes(String(expectedValue).toLowerCase())) return false;
						break;
					default:
						return false;
				}
			}
		} else {
			// Handle direct equality
			if (value !== condition) return false;
		}
	}
	return true;
}

// Helper function to apply text search across all fields
function matchesTextSearch(row: Record<string, any>, searchQuery: string): boolean {
	const lowerQuery = searchQuery.toLowerCase();
	return Object.values(row).some(value => 
		String(value).toLowerCase().includes(lowerQuery)
	);
}

// Helper function to apply ordering
function applyOrdering(rows: Record<string, any>[], orderBy: string): Record<string, any>[] {
	if (!orderBy) return rows;
	
	const parts = orderBy.split(',').map(part => part.trim());
	
	return rows.sort((a, b) => {
		for (const part of parts) {
			const [field, direction] = part.split(':').map(s => s.trim());
			const desc = direction === 'desc';
			
			const aVal = a[field];
			const bVal = b[field];
			
			if (aVal < bVal) return desc ? 1 : -1;
			if (aVal > bVal) return desc ? -1 : 1;
		}
		return 0;
	});
}

// Helper function to apply pagination
function applyPagination(rows: Record<string, any>[], page?: number, limit?: number): Record<string, any>[] {
	if (!limit) return rows;
	
	const pageNum = page || 1;
	const startIndex = (pageNum - 1) * limit;
	const endIndex = startIndex + limit;
	
	return rows.slice(startIndex, endIndex);
}

// Helper function to get sheet data from Google Sheets
async function getSheetDataFromGoogleSheets(
	sheetName: string,
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; data?: Record<string, any>[]; error?: string }> {
	try {
		// First, get the headers and types (rows 1 and 2)
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
			return { success: false as const, error: 'Failed to fetch sheet headers' };
		}

		const headersData = await headersResponse.json() as any;
		const rows = headersData.values || [];
		
		if (rows.length < 2) {
			return { success: false as const, error: 'Invalid sheet structure' };
		}

		const headers = rows[0] || [];
		const types = rows[1] || [];

		// Get all data from row 3 onwards (skip header and type rows)
		const dataResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A3:ZZ`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				}
			}
		);

		if (!dataResponse.ok) {
			return { success: false as const, error: 'Failed to fetch sheet data' };
		}

		const dataResult = await dataResponse.json() as any;
		const dataRows = dataResult.values || [];

		// Convert rows to objects
		const data: Record<string, any>[] = [];
		for (const row of dataRows) {
			const obj: Record<string, any> = {};
			let hasData = false;
			
			for (let i = 0; i < headers.length; i++) {
				const header = headers[i];
				const type = types[i];
				const value = row[i] || '';
				
				if (header) {
					// Convert value based on type
					let convertedValue: any = value;
					
					if (value) {
						hasData = true;
						
						switch (type) {
							case 'number':
								convertedValue = parseFloat(value) || 0;
								break;
							case 'boolean':
								convertedValue = value.toLowerCase() === 'true';
								break;
							case 'datetime':
								convertedValue = value; // Keep as string for now
								break;
							case 'array':
								try {
									convertedValue = JSON.parse(value);
								} catch (e) {
									convertedValue = [];
								}
								break;
							case 'object':
								try {
									convertedValue = JSON.parse(value);
								} catch (e) {
									convertedValue = {};
								}
								break;
							default:
								convertedValue = value;
						}
					} else {
						// Set default values for empty cells
						switch (type) {
							case 'number':
								convertedValue = 0;
								break;
							case 'boolean':
								convertedValue = false;
								break;
							case 'array':
								convertedValue = [];
								break;
							case 'object':
								convertedValue = {};
								break;
							default:
								convertedValue = '';
						}
					}
					
					obj[header] = convertedValue;
				}
			}
			
			// Only add rows that have at least some data
			if (hasData) {
				data.push(obj);
			}
		}

		return { success: true, data };
	} catch (error) {
		console.error('Error fetching sheet data:', error);
		return { success: false as const, error: 'Failed to fetch sheet data' };
	}
}

// Sheet management endpoints
// Generate unique ID for new records
function generateUniqueId(): string {
	// Generate a UUID-like string
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

// Validate input data against sheet schema
async function validateInputData(
	inputData: Record<string, any>,
	columns: Record<string, string>,
	spreadsheetId: string,
	accessToken: string
): Promise<{ valid: boolean; error?: string }> {
	try {
		// Import validation functions
		const { parseColumnSchema, validateValue } = await import('../utils/schema-parser');
		
		// Get column names from the sheet
		const columnNames = Object.keys(columns);
		
		// Check if all input fields exist as columns
		for (const field of Object.keys(inputData)) {
			if (!columnNames.includes(field)) {
				return { valid: false, error: `Column '${field}' does not exist in the sheet` };
			}
		}
		
		// Validate each input field against its schema
		for (const [field, value] of Object.entries(inputData)) {
			const schemaText = columns[field];
			if (schemaText) {
				try {
					const schema = parseColumnSchema(schemaText);
					const validationResult = validateValue(value, schema);
					if (!validationResult.valid) {
						return { valid: false, error: `Field '${field}': ${validationResult.error ?? 'Validation failed'}` };
					}
				} catch (error) {
					// If schema parsing fails, continue without validation
					console.warn(`Failed to parse schema for column '${field}':`, error);
				}
			}
		}
		
		return { valid: true };
	} catch (error) {
		console.error('Error validating input data:', error);
		return { valid: false, error: 'Failed to validate input data' };
	}
}

// Insert data into Google Sheets
async function insertDataToSheet(
	sheetName: string,
	data: Record<string, any>,
	columns: Record<string, string>,
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// Get column names in order
		const columnNames = Object.keys(columns);
		
		// Create row values in the correct order
		const rowValues = columnNames.map(columnName => {
			const value = data[columnName];
			// Convert value to string format suitable for Google Sheets
			if (value === null || value === undefined) {
				return '';
			}
			if (typeof value === 'object') {
				return JSON.stringify(value);
			}
			return String(value);
		});
		
		// Append the row to the sheet
		const appendResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}:append?valueInputOption=RAW`,
			{
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					values: [rowValues]
				})
			}
		);
		
		if (!appendResponse.ok) {
			const error = await appendResponse.text();
			return { success: false as const, error: `Failed to insert data: ${error}` };
		}
		
		return { success: true };
	} catch (error) {
		console.error('Error inserting data to sheet:', error);
		return { success: false as const, error: 'Failed to insert data to sheet' };
	}
}

async function checkDataWritePermission(
	userId: string | null,
	userRoles: string[],
	dataRow: any
): Promise<{ allowed: boolean; error?: string }> {
	try {
		// Check if public_write is true
		if (dataRow.public_write === true || dataRow.public_write === 'true') {
			return { allowed: true };
		}
		
		// If no user is authenticated, no permission for non-public data
		if (!userId) {
			return { allowed: false, error: 'Authentication required for this data' };
		}
		
		// Check if user ID is in user_write
		if (dataRow.user_write) {
			let userWriteArray = [];
			if (typeof dataRow.user_write === 'string') {
				try {
					userWriteArray = JSON.parse(dataRow.user_write);
				} catch (e) {
					userWriteArray = [dataRow.user_write];
				}
			} else if (Array.isArray(dataRow.user_write)) {
				userWriteArray = dataRow.user_write;
			}
			
			if (userWriteArray.includes(userId)) {
				return { allowed: true };
			}
		}
		
		// Check if user's roles are in role_write
		if (dataRow.role_write && userRoles.length > 0) {
			let roleWriteArray = [];
			if (typeof dataRow.role_write === 'string') {
				try {
					roleWriteArray = JSON.parse(dataRow.role_write);
				} catch (e) {
					roleWriteArray = [dataRow.role_write];
				}
			} else if (Array.isArray(dataRow.role_write)) {
				roleWriteArray = dataRow.role_write;
			}
			
			const hasRequiredRole = userRoles.some(role => roleWriteArray.includes(role));
			if (hasRequiredRole) {
				return { allowed: true };
			}
		}
		
		return { allowed: false, error: 'No write permission for this data' };
	} catch (error) {
		console.error('Error checking data write permission:', error);
		return { allowed: false, error: 'Failed to check permissions' };
	}
}

async function getDataRowById(
	sheetName: string,
	dataId: string,
	spreadsheetId: string,
	accessToken: string
): Promise<{ data?: any; error?: string }> {
	try {
		const response = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
				},
			}
		);
		
		if (!response.ok) {
			const errorText = await response.text();
			console.error('Failed to get sheet data:', response.status, errorText);
			return { error: `Failed to get sheet data: ${response.status}` };
		}
		
		const data = await response.json();
		const rows = data.values || [];
		
		if (rows.length < 3) {
			return { error: 'Sheet has no data rows' };
		}
		
		const headers = rows[0];
		const idIndex = headers.findIndex((header: string) => header === 'id');
		
		if (idIndex === -1) {
			return { error: 'Sheet does not have an id column' };
		}
		
		// Find the row with the matching ID (skip headers and types rows)
		for (let i = 2; i < rows.length; i++) {
			const row = rows[i];
			if (row[idIndex] === dataId) {
				// Convert row to object
				const rowObject: any = {};
				for (let j = 0; j < headers.length; j++) {
					const header = headers[j];
					let value = row[j] || '';
					
					// Try to parse JSON values for arrays/objects
					if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
						try {
							value = JSON.parse(value);
						} catch (e) {
							// Keep as string if JSON parsing fails
						}
					}
					
					// Convert boolean strings
					if (value === 'true') value = true;
					if (value === 'false') value = false;
					
					rowObject[header] = value;
				}
				
				return { data: rowObject };
			}
		}
		
		return { error: 'Data not found' };
	} catch (error) {
		console.error('Error getting data row by ID:', error);
		return { error: 'Failed to get data row' };
	}
}

async function updateDataInSheet(
	sheetName: string,
	dataId: string,
	updatedData: Record<string, any>,
	columns: Record<string, string>,
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// First, get the current sheet data to find the row index
		const response = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
				},
			}
		);
		
		if (!response.ok) {
			const errorText = await response.text();
			console.error('Failed to get sheet data:', response.status, errorText);
			return { success: false as const, error: `Failed to get sheet data: ${response.status}` };
		}
		
		const data = await response.json();
		const rows = data.values || [];
		
		if (rows.length < 2) {
			return { success: false as const, error: 'Sheet has no data rows' };
		}
		
		const headers = rows[0];
		const idIndex = headers.findIndex((header: string) => header === 'id');
		
		if (idIndex === -1) {
			return { success: false as const, error: 'Sheet does not have an id column' };
		}
		
		// Find the row with the matching ID (skip headers and types rows)
		let rowIndex = -1;
		for (let i = 2; i < rows.length; i++) {
			const row = rows[i];
			if (row[idIndex] === dataId) {
				rowIndex = i;
				break;
			}
		}
		
		if (rowIndex === -1) {
			return { success: false as const, error: 'Data not found' };
		}
		
		// Get column names in order
		const columnNames = Object.keys(columns);
		
		// Create row values in the correct order
		const rowValues = columnNames.map(columnName => {
			const value = updatedData[columnName];
			// Convert value to string format suitable for Google Sheets
			if (value === null || value === undefined) {
				return '';
			}
			if (typeof value === 'object') {
				return JSON.stringify(value);
			}
			return String(value);
		});
		
		// Update the specific row
		const updateResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A${rowIndex + 1}:${String.fromCharCode(65 + headers.length - 1)}${rowIndex + 1}?valueInputOption=RAW`,
			{
				method: 'PUT',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					values: [rowValues],
					majorDimension: 'ROWS'
				})
			}
		);
		
		if (!updateResponse.ok) {
			const errorText = await updateResponse.text();
			console.error('Failed to update data:', updateResponse.status, errorText);
			return { success: false as const, error: `Failed to update data: ${updateResponse.status}` };
		}
		
		return { success: true };
	} catch (error) {
		console.error('Error updating data in sheet:', error);
		return { success: false as const, error: 'Failed to update data in sheet' };
	}
}

// Clear data in sheet (used for deletion without row shifting)
async function clearDataInSheet(
	sheetName: string,
	dataId: string,
	columns: Record<string, string>,
	spreadsheetId: string,
	accessToken: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// First, get the current sheet data to find the row index
		const response = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
				},
			}
		);
		
		if (!response.ok) {
			const errorText = await response.text();
			console.error('Failed to get sheet data:', response.status, errorText);
			return { success: false as const, error: `Failed to get sheet data: ${response.status}` };
		}
		
		const data = await response.json();
		const rows = data.values || [];
		
		if (rows.length < 2) {
			return { success: false as const, error: 'Sheet has no data rows' };
		}
		
		const headers = rows[0];
		const idIndex = headers.findIndex((header: string) => header === 'id');
		
		if (idIndex === -1) {
			return { success: false as const, error: 'Sheet does not have an id column' };
		}
		
		// Find the row with the matching ID (skip headers and types rows)
		let rowIndex = -1;
		for (let i = 2; i < rows.length; i++) {
			const row = rows[i];
			if (row[idIndex] === dataId) {
				rowIndex = i;
				break;
			}
		}
		
		if (rowIndex === -1) {
			return { success: false as const, error: 'Data not found' };
		}
		
		// Create empty row values to clear the data
		const emptyRowValues = new Array(headers.length).fill('');
		
		// Clear the specific row
		const updateResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A${rowIndex + 1}:${String.fromCharCode(65 + headers.length - 1)}${rowIndex + 1}?valueInputOption=RAW`,
			{
				method: 'PUT',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					values: [emptyRowValues],
					majorDimension: 'ROWS'
				})
			}
		);
		
		if (!updateResponse.ok) {
			const errorText = await updateResponse.text();
			console.error('Failed to clear data:', updateResponse.status, errorText);
			return { success: false as const, error: `Failed to clear data: ${updateResponse.status}` };
		}
		
		return { success: true };
	} catch (error) {
		console.error('Error in clearDataInSheet:', error);
		return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

export function registerSheetRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
	// GET /api/sheets - Get sheet list (OpenAPI)
	app.openapi(getSheetsRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authentication header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Session authentication
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as const, error: authResult.error ?? 'Authentication failed' }, 401);
			}
			
			const userId = authResult.userId;
			if (!userId) {
				return c.json({ success: false as const, error: 'User ID not found in session' }, 401);
			}
			
			// Get Google Sheets settings
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as const, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as const, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as const, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get spreadsheet metadata to get sheet list
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
					return c.json({ success: false as const, error: 'Failed to fetch spreadsheet metadata' }, 500);
				}

				const metadata = await metadataResponse.json() as any;
				const sheets = metadata.sheets || [];
				
				// Create sheet list excluding system sheets (sheets starting with _)
				const sheetList = sheets
					.filter((sheet: any) => !sheet.properties.title.startsWith('_'))
					.map((sheet: any) => ({
						sheetId: sheet.properties.sheetId,
						name: sheet.properties.title
					}));
				
				console.log('Sheets retrieved successfully:', sheetList.length);
				
				// Return success response
				return c.json({
					success: true as true,
					data: {
						sheets: sheetList
					}
				});
				
			} catch (error) {
				console.error('Error fetching sheets:', error);
				return c.json({ success: false as const, error: 'Failed to fetch sheet list' }, 500);
			}
			
		} catch (error) {
			console.error('Error in GET /api/sheets:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as const, error: errorMessage }, 500);
		}
	});

	// POST /api/sheets - Create new sheet (OpenAPI)
	app.openapi(createSheetRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authentication header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Session authentication
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as const, error: authResult.error ?? 'Authentication failed' }, 401);
			}
			
			const userId = authResult.userId;
			if (!userId) {
				return c.json({ success: false as const, error: 'User ID not found in session' }, 401);
			}
			
			const requestData = c.req.valid('json');
			const { name, public_read, public_write, role_read, role_write, user_read, user_write } = requestData;
			
			// Get Google Sheets settings
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as const, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as const, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as const, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get user information (for permission check)
			const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
			if (!user) {
				return c.json({ success: false as const, error: 'User not found in _User sheet' }, 401);
			}
			
			// Check sheet creation permissions
			const permissionCheck = await checkSheetCreationPermission(
				userId,
				user.roles || [],
				spreadsheetId,
				tokens.access_token
			);
			
			if (!permissionCheck.allowed) {
				return c.json({ 
					success: false as const, 
					error: permissionCheck.error ?? 'Permission denied' 
				}, 403);
			}
			
			// Set default value for user_write (include creating user ID)
			const finalUserWrite = user_write.length > 0 ? user_write : [userId];
			
			// Create new sheet
			const createResult = await createGoogleSheet(
				name,
				spreadsheetId,
				tokens.access_token
			);
			
			if (!createResult.success) {
				return c.json({ 
					success: false as const, 
					error: createResult.error ?? 'Failed to create sheet' 
				}, 500);
			}
			
			console.log('Sheet created successfully:', name);
			
			// Return success response
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
			return c.json({ success: false as const, error: errorMessage }, 500);
		}
	});

	// PUT /api/sheets/:id - Update sheet (OpenAPI)
	app.openapi(updateSheetRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authentication header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Session authentication
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as const, error: authResult.error ?? 'Authentication failed' }, 401);
			}
			
			const userId = authResult.userId;
			if (!userId) {
				return c.json({ success: false as const, error: 'User ID not found in session' }, 401);
			}
			
			const { id: sheetId } = c.req.valid('param');
			const updateData = c.req.valid('json');
			
			// Get Google Sheets settings
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as const, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as const, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as const, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get user information (for permission check)
			const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
			if (!user) {
				return c.json({ success: false as const, error: 'User not found in _User sheet' }, 401);
			}
			
			// Get current sheet information
			const sheetInfo = await getSheetInfo(sheetId, spreadsheetId, tokens.access_token);
			if (sheetInfo.error ?? 'Failed to get sheet info') {
				if (sheetInfo.error ?? 'Failed to get sheet info' === 'Sheet not found') {
					return c.json({ success: false as const, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as const, error: sheetInfo.error ?? 'Failed to get sheet info' }, 500);
			}
			
			const { sheetName, sheetId: actualSheetId, metadata } = sheetInfo;
			if (!sheetName || !actualSheetId || !metadata) {
				return c.json({ success: false as const, error: 'Failed to get sheet information' }, 500);
			}
			
			// Check sheet update permissions
			const permissionCheck = await checkSheetUpdatePermission(
				userId,
				user.roles || [],
				metadata
			);
			
			if (!permissionCheck.allowed) {
				return c.json({ 
					success: false as const, 
					error: permissionCheck.error ?? 'Permission denied' 
				}, 403);
			}
			
			// Update sheet
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
					success: false as const, 
					error: updateResult.error ?? 'Failed to update sheet' 
				}, 500);
			}
			
			console.log('Sheet updated successfully:', sheetId);
			
			const finalMetadata = updateResult.updatedMetadata || metadata;
			
			// Return success response
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
			return c.json({ success: false as const, error: errorMessage }, 500);
		}
	});

	// DELETE /api/sheets/:id - Delete sheet (OpenAPI)
	app.openapi(deleteSheetRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authentication header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Session authentication
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as const, error: authResult.error ?? 'Authentication failed' }, 401);
			}
			
			const userId = authResult.userId;
			if (!userId) {
				return c.json({ success: false as const, error: 'User ID not found in session' }, 401);
			}
			
			const { id: sheetId } = c.req.valid('param');
			
			// Get Google Sheets settings
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as const, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as const, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as const, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get user information (for permission check)
			const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
			if (!user) {
				return c.json({ success: false as const, error: 'User not found in _User sheet' }, 401);
			}
			
			// Get current sheet information
			const sheetInfo = await getSheetInfo(sheetId, spreadsheetId, tokens.access_token);
			if (sheetInfo.error ?? 'Failed to get sheet info') {
				if (sheetInfo.error ?? 'Failed to get sheet info' === 'Sheet not found') {
					return c.json({ success: false as const, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as const, error: sheetInfo.error ?? 'Failed to get sheet info' }, 500);
			}
			
			const { sheetName, sheetId: actualSheetId, metadata } = sheetInfo;
			if (!sheetName || !actualSheetId || !metadata) {
				return c.json({ success: false as const, error: 'Failed to get sheet information' }, 500);
			}
			
			// Check sheet deletion permissions (same check as update permissions)
			const permissionCheck = await checkSheetUpdatePermission(
				userId,
				user.roles || [],
				metadata
			);
			
			if (!permissionCheck.allowed) {
				return c.json({ 
					success: false as const, 
					error: permissionCheck.error ?? 'Permission denied' 
				}, 403);
			}
			
			// Delete sheet
			const deleteResult = await deleteGoogleSheet(
				actualSheetId.toString(),
				spreadsheetId,
				tokens.access_token
			);
			
			if (!deleteResult.success) {
				return c.json({ 
					success: false as const, 
					error: deleteResult.error ?? 'Failed to delete sheet' 
				}, 500);
			}
			
			console.log('Sheet deleted successfully:', sheetId, sheetName);
			
			// Return success response
			return c.json({
				success: true as true,
				data: {}
			});
			
		} catch (error) {
			console.error('Error in DELETE /api/sheets/:id:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as const, error: errorMessage }, 500);
		}
	});

	// GET /api/sheets/:id - Get sheet metadata (OpenAPI)
	app.openapi(getSheetMetadataRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			const { id: sheetIdOrName } = c.req.valid('param');
			
			// Optional authentication implementation
			const authHeader = c.req.header('authorization');
			let userId: string | null = null;
			let userRoles: string[] = [];
			let isAuthenticated = false;
			
			// Only attempt authentication if authentication header is provided
			if (authHeader) {
				const sessionId = authHeader.replace('Bearer ', '');
				const authResult = await authenticateSession(db, sessionId);
				if (authResult.valid && authResult.userId) {
					userId = authResult.userId;
					isAuthenticated = true;
				}
			}
			
			// Get Google Sheets settings
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as const, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as const, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as const, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// If authenticated, get user information
			if (isAuthenticated && userId) {
				const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
				if (user) {
					userRoles = user.roles || [];
				}
			}
			
			// Get sheet information (search by ID or name)
			const sheetInfo = await getSheetInfo(sheetIdOrName, spreadsheetId, tokens.access_token);
			if (sheetInfo.error ?? 'Failed to get sheet info') {
				if (sheetInfo.error ?? 'Failed to get sheet info' === 'Sheet not found') {
					return c.json({ success: false as const, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as const, error: sheetInfo.error ?? 'Failed to get sheet info' }, 500);
			}
			
			const { sheetName, sheetId, columns, metadata } = sheetInfo;
			if (!sheetName || !sheetId || !columns || !metadata) {
				return c.json({ success: false as const, error: 'Failed to get sheet information' }, 500);
			}
			
			// Check sheet read permissions
			const permissionCheck = await checkSheetReadPermission(userId, userRoles, metadata);
			if (!permissionCheck.allowed) {
				if (permissionCheck.error === 'Authentication required for this sheet') {
					return c.json({ success: false as const, error: permissionCheck.error ?? 'Permission denied' }, 401);
				}
				return c.json({ success: false as const, error: permissionCheck.error ?? 'Permission denied' }, 403);
			}
			
			// Convert column information (name, type, required flag)
			const formattedColumns = Object.entries(columns).map(([name, type]) => ({
				name,
				type: type as 'string' | 'number' | 'datetime' | 'boolean' | 'pointer' | 'array' | 'object',
				required: ['id', 'created_at', 'updated_at'].includes(name) // Set default required fields
			}));
			
			console.log('Sheet metadata retrieved successfully:', sheetIdOrName, sheetName, sheetId);
			
			// Return success response
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
			return c.json({ success: false as const, error: errorMessage }, 500);
		}
	});

	// POST /api/sheets/:id/columns - Add columns to sheet (OpenAPI)
	app.openapi(addColumnsRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authentication header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Session authentication
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as const, error: authResult.error ?? 'Authentication failed' }, 401);
			}
			
			const userId = authResult.userId;
			if (!userId) {
				return c.json({ success: false as const, error: 'User ID not found in session' }, 401);
			}
			
			const { id: sheetId } = c.req.valid('param');
			const newColumns = c.req.valid('json');
			
			// Get Google Sheets settings
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as const, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as const, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as const, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get user information (for permission check)
			const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
			if (!user) {
				return c.json({ success: false as const, error: 'User not found in _User sheet' }, 401);
			}
			
			// Get sheet information
			const sheetInfo = await getSheetInfo(sheetId, spreadsheetId, tokens.access_token);
			if (sheetInfo.error ?? 'Failed to get sheet info') {
				if (sheetInfo.error ?? 'Failed to get sheet info' === 'Sheet not found') {
					return c.json({ success: false as const, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as const, error: sheetInfo.error ?? 'Failed to get sheet info' }, 500);
			}
			
			const { sheetName, sheetId: actualSheetId, metadata } = sheetInfo;
			if (!sheetName || !actualSheetId || !metadata) {
				return c.json({ success: false as const, error: 'Failed to get sheet information' }, 500);
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
					success: false as const, 
					error: permissionCheck.error ?? 'Permission denied' 
				}, 403);
			}
			
			// Add columns to sheet
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
						success: false as const, 
						error: addResult.error ?? 'Failed to add column' 
					}, 400);
				}
				return c.json({ 
					success: false as const, 
					error: addResult.error ?? 'Failed to add columns' 
				}, 500);
			}
			
			console.log('Columns added successfully to sheet:', sheetId, sheetName);
			
			// Return success response
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
			return c.json({ success: false as const, error: errorMessage }, 500);
		}
	});

	// DELETE /api/sheets/:id/columns/:columnId - Delete a column from a sheet (OpenAPI)
	app.openapi(deleteColumnRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authorization header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Authenticate session
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as const, error: authResult.error ?? 'Authentication failed' }, 401);
			}
			
			const userId = authResult.userId;
			if (!userId) {
				return c.json({ success: false as const, error: 'User ID not found in session' }, 401);
			}
			
			const { id: sheetId, columnId: columnName } = c.req.valid('param');
			
			// Apply rate limiting
		const rateLimiter = userId ? dataInsertionRateLimiter : unauthenticatedRateLimiter;
		const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
		const rateLimitKey = userId || clientIP;
		
		const rateLimitResult = await rateLimiter.checkRateLimit(rateLimitKey, c.env?.RATE_LIMIT_KV);
		if (!rateLimitResult.allowed) {
			logger.warn('Rate limit exceeded for data insertion', { 
				userId, 
				clientIP,
				rateLimitKey 
			});
			return c.json({ 
				success: false as const, 
				error: rateLimitResult.error ?? 'Rate limit exceeded',
				retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
			}, 429);
		}
		
		// Get Google Sheets configuration
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as const, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google tokens
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as const, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if needed
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as const, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get user information (for permission check)
			const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
			if (!user) {
				return c.json({ success: false as const, error: 'User not found in _User sheet' }, 401);
			}
			
			// Get sheet information
			const sheetInfo = await getSheetInfo(sheetId, spreadsheetId, tokens.access_token);
			if (sheetInfo.error ?? 'Failed to get sheet info') {
				if (sheetInfo.error ?? 'Failed to get sheet info' === 'Sheet not found') {
					return c.json({ success: false as const, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as const, error: sheetInfo.error ?? 'Failed to get sheet info' }, 500);
			}
			
			const { sheetName, sheetId: actualSheetId } = sheetInfo;
			if (!sheetName || !actualSheetId) {
				return c.json({ success: false as const, error: 'Failed to get sheet information' }, 500);
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
					success: false as const, 
					error: permissionCheck.error ?? 'Permission denied' 
				}, 403);
			}
			
			// Delete the column from the sheet
			const deleteResult = await deleteColumnFromGoogleSheet(
				actualSheetId.toString(),
				sheetName,
				columnName,
				spreadsheetId,
				tokens.access_token
			);
			
			if (!deleteResult.success) {
				if (deleteResult.error === 'Column not found') {
					return c.json({ 
						success: false as const, 
						error: 'Column not found' 
					}, 404);
				}
				if (deleteResult.error === 'System columns cannot be deleted') {
					return c.json({ 
						success: false as const, 
						error: 'System columns cannot be deleted' 
					}, 400);
				}
				return c.json({ 
					success: false as const, 
					error: deleteResult.error ?? 'Failed to delete column' 
				}, 500);
			}
			
			console.log('Column deleted successfully from sheet:', sheetId, sheetName, columnName);
			
			// Return success response
			return c.json({
				success: true as true,
				data: {
					sheetId: actualSheetId,
					name: sheetName,
					columnName: columnName,
					action: deleteResult.action ?? 'cleared',
					message: `Column '${columnName}' ${deleteResult.action ?? 'cleared'} successfully from sheet '${sheetName}'`
				}
			});
			
		} catch (error) {
			console.error('Error in DELETE /api/sheets/:id/columns/:columnId:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as const, error: errorMessage }, 500);
		}
	});

	// PUT /api/sheets/:id/columns/:columnId - Update a column in a sheet (OpenAPI)
	app.openapi(updateColumnRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get session ID from authorization header
			const authHeader = c.req.valid('header').authorization;
			const sessionId = authHeader.replace('Bearer ', '');
			
			// Authenticate session
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				return c.json({ success: false as const, error: authResult.error ?? 'Authentication failed' }, 401);
			}
			
			const userId = authResult.userId;
			if (!userId) {
				return c.json({ success: false as const, error: 'User ID not found in session' }, 401);
			}
			
			const { id: sheetId, columnId: columnName } = c.req.valid('param');
			const updateData = c.req.valid('json');
			
			// Validate that type is not being modified
			if ('type' in updateData) {
				return c.json({ 
					success: false as const, 
					error: 'Type modification is not allowed' 
				}, 400);
			}
			
			// Apply rate limiting
		const rateLimiter = userId ? dataInsertionRateLimiter : unauthenticatedRateLimiter;
		const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
		const rateLimitKey = userId || clientIP;
		
		const rateLimitResult = await rateLimiter.checkRateLimit(rateLimitKey, c.env?.RATE_LIMIT_KV);
		if (!rateLimitResult.allowed) {
			logger.warn('Rate limit exceeded for data insertion', { 
				userId, 
				clientIP,
				rateLimitKey 
			});
			return c.json({ 
				success: false as const, 
				error: rateLimitResult.error ?? 'Rate limit exceeded',
				retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
			}, 429);
		}
		
		// Get Google Sheets configuration
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as const, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google tokens
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as const, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if needed
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as const, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get user information (for permission check)
			const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
			if (!user) {
				return c.json({ success: false as const, error: 'User not found in _User sheet' }, 401);
			}
			
			// Get sheet information
			const sheetInfo = await getSheetInfo(sheetId, spreadsheetId, tokens.access_token);
			if (sheetInfo.error ?? 'Failed to get sheet info') {
				if (sheetInfo.error ?? 'Failed to get sheet info' === 'Sheet not found') {
					return c.json({ success: false as const, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as const, error: sheetInfo.error ?? 'Failed to get sheet info' }, 500);
			}
			
			const { sheetName, sheetId: actualSheetId } = sheetInfo;
			if (!sheetName || !actualSheetId) {
				return c.json({ success: false as const, error: 'Failed to get sheet information' }, 500);
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
					success: false as const, 
					error: permissionCheck.error ?? 'Permission denied' 
				}, 403);
			}
			
			// Update the column in the sheet
			const updateResult = await updateColumnInGoogleSheet(
				actualSheetId.toString(),
				sheetName,
				columnName,
				updateData,
				spreadsheetId,
				tokens.access_token
			);
			
			if (!updateResult.success) {
				if (updateResult.error === 'Column not found') {
					return c.json({ 
						success: false as const, 
						error: 'Column not found' 
					}, 404);
				}
				if (updateResult.error === 'System columns cannot be modified') {
					return c.json({ 
						success: false as const, 
						error: 'System columns cannot be modified' 
					}, 400);
				}
				if (updateResult.error === 'Column name already exists') {
					return c.json({ 
						success: false as const, 
						error: 'Column name already exists' 
					}, 400);
				}
				return c.json({ 
					success: false as const, 
					error: updateResult.error ?? 'Failed to update column' 
				}, 500);
			}
			
			console.log('Column updated successfully in sheet:', sheetId, sheetName, columnName);
			
			// Return success response
			return c.json({
				success: true as true,
				data: {
					sheetId: actualSheetId,
					name: sheetName,
					columnName: updateData.name || columnName,
					updatedColumn: updateResult.updatedColumn,
					message: `Column '${columnName}' updated successfully in sheet '${sheetName}'`
				}
			});
			
		} catch (error) {
			console.error('Error in PUT /api/sheets/:id/columns/:columnId:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as const, error: errorMessage }, 500);
		}
	});

	// GET /api/sheets/:id/columns/:columnId - Get column schema information (OpenAPI)
	app.openapi(getColumnInfoRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			const { id: sheetIdOrName, columnId: columnName } = c.req.valid('param');
			
			// Optional authentication implementation
			const authHeader = c.req.header('authorization');
			let userId: string | null = null;
			let userRoles: string[] = [];
			let isAuthenticated = false;
			
			// Try authentication only if authorization header is provided
			if (authHeader) {
				const sessionId = authHeader.replace('Bearer ', '');
				const authResult = await authenticateSession(db, sessionId);
				if (authResult.valid && authResult.userId) {
					userId = authResult.userId;
					isAuthenticated = true;
				}
			}
			
			// Apply rate limiting
		const rateLimiter = userId ? dataInsertionRateLimiter : unauthenticatedRateLimiter;
		const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
		const rateLimitKey = userId || clientIP;
		
		const rateLimitResult = await rateLimiter.checkRateLimit(rateLimitKey, c.env?.RATE_LIMIT_KV);
		if (!rateLimitResult.allowed) {
			logger.warn('Rate limit exceeded for data insertion', { 
				userId, 
				clientIP,
				rateLimitKey 
			});
			return c.json({ 
				success: false as const, 
				error: rateLimitResult.error ?? 'Rate limit exceeded',
				retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
			}, 429);
		}
		
		// Get Google Sheets configuration
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as const, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google tokens
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as const, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if needed
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as const, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get user information if authenticated
			if (isAuthenticated && userId) {
				const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
				if (user) {
					userRoles = user.roles || [];
				}
			}
			
			// Get sheet information (ID or name search)
			const sheetInfo = await getSheetInfo(sheetIdOrName, spreadsheetId, tokens.access_token);
			if (sheetInfo.error ?? 'Failed to get sheet info') {
				if (sheetInfo.error ?? 'Failed to get sheet info' === 'Sheet not found') {
					return c.json({ success: false as const, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as const, error: sheetInfo.error ?? 'Failed to get sheet info' }, 500);
			}
			
			const { sheetName, sheetId, columns, metadata } = sheetInfo;
			if (!sheetName || !sheetId || !columns || !metadata) {
				return c.json({ success: false as const, error: 'Failed to get sheet information' }, 500);
			}
			
			// Check sheet read permission
			const permissionCheck = await checkSheetReadPermission(userId, userRoles, metadata);
			if (!permissionCheck.allowed) {
				if (permissionCheck.error === 'Authentication required for this sheet') {
					return c.json({ success: false as const, error: permissionCheck.error ?? 'Permission denied' }, 401);
				}
				return c.json({ success: false as const, error: permissionCheck.error ?? 'Permission denied' }, 403);
			}
			
			// Check if column exists
			if (!columns[columnName]) {
				return c.json({ success: false as const, error: 'Column not found' }, 404);
			}
			
			// Parse column schema using schema parser
			const { parseColumnSchema } = await import('../utils/schema-parser');
			const columnSchema = parseColumnSchema(columns[columnName]);
			
			console.log('Column information retrieved successfully:', sheetIdOrName, sheetName, columnName);
			
			// Return success response
			return c.json({
				success: true as true,
				data: {
					sheetId: sheetId,
					sheetName: sheetName,
					columnName: columnName,
					schema: {
						type: columnSchema.type,
						required: columnSchema.required,
						unique: columnSchema.unique,
						pattern: columnSchema.pattern,
						minLength: columnSchema.minLength,
						maxLength: columnSchema.maxLength,
						min: columnSchema.min,
						max: columnSchema.max,
						default: columnSchema.default
					}
				}
			});
			
		} catch (error) {
			console.error('Error in GET /api/sheets/:id/columns/:columnId:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as const, error: errorMessage }, 500);
		}
	});

	// GET /api/sheets/:id/data - Get sheet data with query support (OpenAPI)
	app.openapi(getSheetDataRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			const { id: sheetIdOrName } = c.req.valid('param');
			const { query, where, limit, page, order, count } = c.req.valid('query');
			
			// Optional authentication implementation
			const authHeader = c.req.header('authorization');
			let userId: string | null = null;
			let userRoles: string[] = [];
			let isAuthenticated = false;
			
			// Try authentication only if authorization header is provided
			if (authHeader) {
				const sessionId = authHeader.replace('Bearer ', '');
				const authResult = await authenticateSession(db, sessionId);
				if (authResult.valid && authResult.userId) {
					userId = authResult.userId;
					isAuthenticated = true;
				}
			}
			
			// Apply rate limiting
		const rateLimiter = userId ? dataInsertionRateLimiter : unauthenticatedRateLimiter;
		const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
		const rateLimitKey = userId || clientIP;
		
		const rateLimitResult = await rateLimiter.checkRateLimit(rateLimitKey, c.env?.RATE_LIMIT_KV);
		if (!rateLimitResult.allowed) {
			logger.warn('Rate limit exceeded for data insertion', { 
				userId, 
				clientIP,
				rateLimitKey 
			});
			return c.json({ 
				success: false as const, 
				error: rateLimitResult.error ?? 'Rate limit exceeded',
				retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
			}, 429);
		}
		
		// Get Google Sheets configuration
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as const, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google tokens
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as const, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if needed
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as const, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get user information if authenticated
			if (isAuthenticated && userId) {
				const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
				if (user) {
					userRoles = user.roles || [];
				}
			}
			
			// Get sheet information (ID or name search)
			const sheetInfo = await getSheetInfo(sheetIdOrName, spreadsheetId, tokens.access_token);
			if (sheetInfo.error ?? 'Failed to get sheet info') {
				if (sheetInfo.error ?? 'Failed to get sheet info' === 'Sheet not found') {
					return c.json({ success: false as const, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as const, error: sheetInfo.error ?? 'Failed to get sheet info' }, 500);
			}
			
			const { sheetName, sheetId, metadata } = sheetInfo;
			if (!sheetName || !sheetId || !metadata) {
				return c.json({ success: false as const, error: 'Failed to get sheet information' }, 500);
			}
			
			// Check sheet read permission
			const permissionCheck = await checkSheetReadPermission(userId, userRoles, metadata);
			if (!permissionCheck.allowed) {
				if (permissionCheck.error === 'Authentication required for this sheet') {
					return c.json({ success: false as const, error: permissionCheck.error ?? 'Permission denied' }, 401);
				}
				return c.json({ success: false as const, error: permissionCheck.error ?? 'Permission denied' }, 403);
			}
			
			// Get sheet data
			const dataResult = await getSheetDataFromGoogleSheets(sheetName, spreadsheetId, tokens.access_token);
			if (!dataResult.success) {
				return c.json({ success: false as const, error: dataResult.error ?? 'Failed to get sheet data' }, 500);
			}
			
			let data = dataResult.data || [];
			
			// Apply text search if provided
			if (query) {
				data = data.filter(row => matchesTextSearch(row, query));
			}
			
			// Apply WHERE conditions if provided
			if (where) {
				try {
					const whereCondition = parseWhereCondition(where);
					data = data.filter(row => matchesWhereCondition(row, whereCondition));
				} catch (error) {
					return c.json({ success: false as const, error: 'Invalid WHERE condition format' }, 400);
				}
			}
			
			// Store total count before pagination
			const totalCount = data.length;
			
			// Apply ordering if provided
			if (order) {
				try {
					data = applyOrdering(data, order);
				} catch (error) {
					return c.json({ success: false as const, error: 'Invalid order format' }, 400);
				}
			}
			
			// Apply pagination if provided
			if (limit) {
				data = applyPagination(data, page, limit);
			}
			
			console.log('Sheet data retrieved successfully:', sheetIdOrName, sheetName, 'rows:', data.length);
			
			// Build response
			const response: any = {
				success: true,
				results: data
			};
			
			// Add count if requested
			if (count) {
				response.count = totalCount;
			}
			
			return c.json(response);
			
		} catch (error) {
			console.error('Error in GET /api/sheets/:id/data:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as const, error: errorMessage }, 500);
		}
	});

	// POST /api/sheets/:id/data - Create sheet data (OpenAPI)
	app.openapi(createSheetDataRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			const { id: sheetIdOrName } = c.req.valid('param');
			const inputData = c.req.valid('json');
			
			// Optional authentication implementation
			const authHeader = c.req.header('authorization');
			let userId: string | null = null;
			let userRoles: string[] = [];
			let isAuthenticated = false;
			
			// Try authentication only if authorization header is provided
			if (authHeader) {
				const sessionId = authHeader.replace('Bearer ', '');
				const authResult = await authenticateSession(db, sessionId);
				if (authResult.valid && authResult.userId) {
					userId = authResult.userId;
					isAuthenticated = true;
				}
			}
			
			// Apply rate limiting
		const rateLimiter = userId ? dataInsertionRateLimiter : unauthenticatedRateLimiter;
		const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
		const rateLimitKey = userId || clientIP;
		
		const rateLimitResult = await rateLimiter.checkRateLimit(rateLimitKey, c.env?.RATE_LIMIT_KV);
		if (!rateLimitResult.allowed) {
			logger.warn('Rate limit exceeded for data insertion', { 
				userId, 
				clientIP,
				rateLimitKey 
			});
			return c.json({ 
				success: false as const, 
				error: rateLimitResult.error ?? 'Rate limit exceeded',
				retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
			}, 429);
		}
		
		// Get Google Sheets configuration
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as const, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google tokens
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as const, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if needed
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as const, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get user information if authenticated
			if (isAuthenticated && userId) {
				const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
				if (user) {
					userRoles = user.roles || [];
				}
			}
			
			// Get sheet information (ID or name search)
			const sheetInfo = await getSheetInfo(sheetIdOrName, spreadsheetId, tokens.access_token);
			if (sheetInfo.error ?? 'Failed to get sheet info') {
				if (sheetInfo.error ?? 'Failed to get sheet info' === 'Sheet not found') {
					return c.json({ success: false as const, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as const, error: sheetInfo.error ?? 'Failed to get sheet info' }, 500);
			}
			
			const { sheetName, sheetId, columns, metadata } = sheetInfo;
			if (!sheetName || !sheetId || !columns || !metadata) {
				return c.json({ success: false as const, error: 'Failed to get sheet information' }, 500);
			}
			
			// Check write permissions for data insertion
			const permissionCheck = await checkSheetWritePermission(userId, userRoles, metadata);
			if (!permissionCheck.allowed) {
				return c.json({ success: false as const, error: permissionCheck.error ?? 'No write permission for this sheet' }, 403);
			}
			
			// Log data insertion attempt for audit trail
			logger.info('Data insertion attempted', {
				userId: userId,
				sheetId: spreadsheetId,
				sheetName: sheetName,
				timestamp: new Date().toISOString()
			});
			
			// Enhanced data validation for security
			const securityValidation = await sheetDataValidator.validateInputData(inputData, 'sheet_data_insertion');
			if (!securityValidation.valid) {
				return c.json({ success: false as const, error: securityValidation.error ?? 'Security validation failed' }, 400);
			}
			
			// Use sanitized data for further processing
			const sanitizedData = securityValidation.sanitizedData;
			
			// Validate input data against sheet schema
			const validationResult = await validateInputData(sanitizedData, columns, spreadsheetId, tokens.access_token);
			if (!validationResult.valid) {
				return c.json({ success: false as const, error: validationResult.error ?? 'Validation failed' }, 400);
			}
			
			// Generate ID and timestamps
			const id = generateUniqueId();
			const now = new Date().toISOString();
			
			// Create complete data object with system fields
			const completeData = {
				id,
				created_at: now,
				updated_at: now,
				...sanitizedData
			};
			
			// Set default user_read and user_write for authenticated users
			if (userId) {
				// Only set defaults if permissions weren't explicitly set to empty
				if (!completeData.user_read && !sanitizedData.hasOwnProperty('user_read')) {
					completeData.user_read = [userId];
				}
				if (!completeData.user_write && !sanitizedData.hasOwnProperty('user_write')) {
					completeData.user_write = [userId];
				}
			}
			
			// Insert data into Google Sheets
			const insertResult = await insertDataToSheet(sheetName, completeData, columns, spreadsheetId, tokens.access_token);
			if (!insertResult.success) {
				return c.json({ success: false as const, error: insertResult.error ?? 'Failed to insert data' }, 500);
			}
			
			// Check if user has read permission to return the data
			const readPermissionCheck = await checkSheetReadPermission(userId, userRoles, metadata);
			if (!readPermissionCheck.allowed) {
				// Return empty object if user doesn't have read permission
				return c.json({ success: true, data: {} });
			}
			
			// Return the complete data with generated fields
			return c.json({ success: true, data: completeData });
			
		} catch (error) {
			console.error('Error in POST /api/sheets/:id/data:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as const, error: errorMessage }, 500);
		}
	});

	// PUT /api/sheets/:id/data/:dataId - Update sheet data
	app.openapi(updateSheetDataRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			const { id: sheetIdOrName, dataId } = c.req.valid('param');
			const updateData = c.req.valid('json');
			
			// Optional authentication implementation
			const authHeader = c.req.header('authorization');
			let userId: string | null = null;
			let userRoles: string[] = [];
			let isAuthenticated = false;
			
			// Try authentication only if authorization header is provided
			if (authHeader) {
				const sessionId = authHeader.replace('Bearer ', '');
				const authResult = await authenticateSession(db, sessionId);
				if (authResult.valid && authResult.userId) {
					userId = authResult.userId;
					isAuthenticated = true;
				}
			}
			
			// Apply rate limiting
			const rateLimiter = userId ? dataInsertionRateLimiter : unauthenticatedRateLimiter;
			const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
			const rateLimitKey = userId || clientIP;
			
			const rateLimitResult = await rateLimiter.checkRateLimit(rateLimitKey, c.env?.RATE_LIMIT_KV);
			if (!rateLimitResult.allowed) {
				logger.warn('Rate limit exceeded for data update', { 
					userId, 
					clientIP,
					rateLimitKey 
				});
				return c.json({ 
					success: false as const, 
					error: rateLimitResult.error ?? 'Rate limit exceeded',
					retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
				}, 429);
			}
			
			// Get Google Sheets configuration
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as const, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google tokens
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as const, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if needed
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as const, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get user information if authenticated
			if (isAuthenticated && userId) {
				const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
				if (user) {
					userRoles = user.roles || [];
				}
			}
			
			// Get sheet information (ID or name search)
			const sheetInfo = await getSheetInfo(sheetIdOrName, spreadsheetId, tokens.access_token);
			if (sheetInfo.error ?? 'Failed to get sheet info') {
				if (sheetInfo.error ?? 'Failed to get sheet info' === 'Sheet not found') {
					return c.json({ success: false as const, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as const, error: sheetInfo.error ?? 'Failed to get sheet info' }, 500);
			}
			
			const { sheetName, sheetId, columns, metadata } = sheetInfo;
			if (!sheetName || !sheetId || !columns || !metadata) {
				return c.json({ success: false as const, error: 'Failed to get sheet information' }, 500);
			}
			
			// Get existing data row
			const existingDataResult = await getDataRowById(sheetName, dataId, spreadsheetId, tokens.access_token);
			if (existingDataResult.error ?? 'Failed to get existing data') {
				if (existingDataResult.error ?? 'Failed to get existing data' === 'Data not found') {
					return c.json({ success: false as const, error: 'Data not found' }, 404);
				}
				return c.json({ success: false as const, error: existingDataResult.error ?? 'Failed to get existing data' }, 500);
			}
			
			const existingData = existingDataResult.data;
			if (!existingData) {
				return c.json({ success: false as const, error: 'Data not found' }, 404);
			}
			
			// Check data-specific write permissions
			const dataPermissionCheck = await checkDataWritePermission(userId, userRoles, existingData);
			if (!dataPermissionCheck.allowed) {
				return c.json({ success: false as const, error: dataPermissionCheck.error ?? 'No write permission for this data' }, 403);
			}
			
			// Log data update attempt for audit trail
			logger.info('Data update attempted', {
				userId: userId,
				sheetId: spreadsheetId,
				sheetName: sheetName,
				dataId: dataId,
				timestamp: new Date().toISOString()
			});
			
			// Enhanced data validation for security
			const securityValidation = await sheetDataValidator.validateInputData(updateData, 'sheet_data_update');
			if (!securityValidation.valid) {
				return c.json({ success: false as const, error: securityValidation.error ?? 'Security validation failed' }, 400);
			}
			
			// Use sanitized data for further processing
			const sanitizedData = securityValidation.sanitizedData;
			
			// Validate input data against sheet schema
			const validationResult = await validateInputData(sanitizedData, columns, spreadsheetId, tokens.access_token);
			if (!validationResult.valid) {
				return c.json({ success: false as const, error: validationResult.error ?? 'Validation failed' }, 400);
			}
			
			// Update timestamp
			const now = new Date().toISOString();
			
			// Remove protected fields that cannot be updated
			const { id: _id, created_at: _created, updated_at: _updated, ...filteredData } = sanitizedData;
			
			// Create updated data object
			const updatedData = {
				...existingData,
				...filteredData,
				updated_at: now
			};
			
			// Update data in Google Sheets
			const updateResult = await updateDataInSheet(sheetName, dataId, updatedData, columns, spreadsheetId, tokens.access_token);
			if (!updateResult.success) {
				return c.json({ success: false as const, error: updateResult.error ?? 'Failed to update data' }, 500);
			}
			
			// Return the updated data
			return c.json({ success: true, data: updatedData });
			
		} catch (error) {
			console.error('Error in PUT /api/sheets/:id/data/:dataId:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as const, error: errorMessage }, 500);
		}
	});

	// DELETE /api/sheets/:id/data/:dataId - Delete sheet data
	app.openapi(deleteSheetDataRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			const { id: sheetIdOrName, dataId } = c.req.valid('param');
			
			// Optional authentication implementation
			const authHeader = c.req.header('authorization');
			let userId: string | null = null;
			let userRoles: string[] = [];
			let isAuthenticated = false;
			
			// Try authentication only if authorization header is provided
			if (authHeader) {
				const sessionId = authHeader.replace('Bearer ', '');
				const authResult = await authenticateSession(db, sessionId);
				if (authResult.valid && authResult.userId) {
					userId = authResult.userId;
					isAuthenticated = true;
				}
			}
			
			// Apply rate limiting
			const rateLimiter = userId ? dataInsertionRateLimiter : unauthenticatedRateLimiter;
			const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
			const rateLimitKey = userId || clientIP;
			
			const rateLimitResult = await rateLimiter.checkRateLimit(rateLimitKey, c.env?.RATE_LIMIT_KV);
			if (!rateLimitResult.allowed) {
				logger.warn('Rate limit exceeded for data deletion', { 
					userId, 
					clientIP,
					rateLimitKey 
				});
				return c.json({ 
					success: false as const, 
					error: rateLimitResult.error ?? 'Rate limit exceeded',
					retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
				}, 429);
			}
			
			// Get Google Sheets configuration
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ success: false as const, error: 'No spreadsheet selected' }, 500);
			}
			
			// Get valid Google tokens
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ success: false as const, error: 'No valid Google token found' }, 500);
			}
			
			// Check token validity and refresh if needed
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (credentials && tokens.refresh_token) {
					tokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, tokens);
				} else {
					return c.json({ success: false as const, error: 'Failed to refresh Google token' }, 500);
				}
			}
			
			// Get user information if authenticated
			if (isAuthenticated && userId) {
				const user = await getUserFromSheet(userId, spreadsheetId, tokens.access_token);
				if (user) {
					userRoles = user.roles || [];
				}
			}
			
			// Get sheet information (ID or name search)
			const sheetInfo = await getSheetInfo(sheetIdOrName, spreadsheetId, tokens.access_token);
			if (sheetInfo.error ?? 'Failed to get sheet info') {
				if (sheetInfo.error ?? 'Failed to get sheet info' === 'Sheet not found') {
					return c.json({ success: false as const, error: 'Sheet not found' }, 404);
				}
				return c.json({ success: false as const, error: sheetInfo.error ?? 'Failed to get sheet info' }, 500);
			}
			
			const { sheetName, sheetId, columns, metadata } = sheetInfo;
			if (!sheetName || !sheetId || !columns || !metadata) {
				return c.json({ success: false as const, error: 'Failed to get sheet information' }, 500);
			}
			
			// Get existing data row
			const existingDataResult = await getDataRowById(sheetName, dataId, spreadsheetId, tokens.access_token);
			if (existingDataResult.error ?? 'Failed to get existing data') {
				if (existingDataResult.error ?? 'Failed to get existing data' === 'Data not found') {
					return c.json({ success: false as const, error: 'Data not found' }, 404);
				}
				return c.json({ success: false as const, error: existingDataResult.error ?? 'Failed to get existing data' }, 500);
			}
			
			const existingData = existingDataResult.data;
			if (!existingData) {
				return c.json({ success: false as const, error: 'Data not found' }, 404);
			}
			
			// Check data-specific write permissions
			const dataPermissionCheck = await checkDataWritePermission(userId, userRoles, existingData);
			if (!dataPermissionCheck.allowed) {
				return c.json({ success: false as const, error: dataPermissionCheck.error ?? 'No write permission for this data' }, 403);
			}
			
			// Log data deletion attempt for audit trail
			logger.info('Data deletion attempted', {
				userId: userId,
				sheetId: spreadsheetId,
				sheetName: sheetName,
				dataId: dataId,
				timestamp: new Date().toISOString()
			});
			
			// Clear data in Google Sheets (instead of deleting row to prevent row shifting)
			const clearResult = await clearDataInSheet(sheetName, dataId, columns, spreadsheetId, tokens.access_token);
			if (!clearResult.success) {
				return c.json({ success: false as const, error: clearResult.error ?? 'Failed to delete data' }, 500);
			}
			
			// Log successful deletion
			logger.info('Data deletion successful', {
				userId: userId,
				sheetId: spreadsheetId,
				sheetName: sheetName,
				dataId: dataId,
				timestamp: new Date().toISOString()
			});
			
			// Return empty JSON response as specified in requirements
			return c.json({});
			
		} catch (error) {
			console.error('Error in DELETE /api/sheets/:id/data/:dataId:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false as const, error: errorMessage }, 500);
		}
	});
}