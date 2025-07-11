/**
 * Shared utility functions for Google Sheets operations
 */

// _Configシートから複数の設定値を一度に取得するヘルパー関数
export async function getMultipleConfigsFromSheet(
	keys: string[], 
	spreadsheetId: string, 
	accessToken: string
): Promise<Record<string, string>> {
	try {
		// _Configシートから設定情報を取得
		const response = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Config!A:B`,
			{
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				}
			}
		);

		if (!response.ok) {
			console.error('Failed to fetch config data:', response.status);
			return {};
		}

		const data = await response.json() as any;
		const rows = data.values || [];
		
		// 結果を格納するオブジェクト
		const configs: Record<string, string> = {};
		
		// ヘッダー行をスキップして、2行目以降から設定を検索
		for (const row of rows.slice(1)) {
			if (row[0] && keys.includes(row[0]) && row[1]) {
				configs[row[0]] = row[1];
			}
		}

		return configs;
	} catch (error) {
		console.error('Error getting configs from sheet:', error);
		return {};
	}
}

// _Configシートから単一の設定値を取得するヘルパー関数
export async function getConfigFromSheet(key: string, spreadsheetId: string, accessToken: string): Promise<string | null> {
	const configs = await getMultipleConfigsFromSheet([key], spreadsheetId, accessToken);
	return configs[key] || null;
}

// ユーザー情報をGoogle Sheetsから取得するヘルパー関数
export async function getUserFromSheet(userId: string, spreadsheetId: string, accessToken: string): Promise<any | null> {
	try {
		console.log(`[getUserFromSheet] Searching for user ID: "${userId}"`);
		
		// _Userシートからユーザー情報を取得
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
			console.error('Failed to fetch user data:', response.status);
			return null;
		}

		const data = await response.json() as any;
		const rows = data.values || [];
		
		console.log(`[getUserFromSheet] Total rows in _User sheet: ${rows.length}`);
		console.log(`[getUserFromSheet] Header row (row 0):`, rows[0]);
		console.log(`[getUserFromSheet] Type row (row 1):`, rows[1]);
		
		// 3行目以降（データ行）の最初の数行をログ出力
		for (let i = 2; i < Math.min(rows.length, 7); i++) {
			console.log(`[getUserFromSheet] Data row ${i} (sheet row ${i+1}):`, rows[i]);
			if (rows[i] && rows[i][0]) {
				console.log(`[getUserFromSheet] Row ${i} ID: "${rows[i][0]}" (comparing with "${userId}")`);
				console.log(`[getUserFromSheet] ID comparison result: ${rows[i][0] === userId}`);
			}
		}
		
		// ヘッダー行（1行目）と型定義行（2行目）をスキップして、3行目以降からユーザーを検索
		const userRow = rows.find((row: string[], index: number) => 
			index >= 2 && row[0] === userId
		);

		if (!userRow) {
			console.log(`[getUserFromSheet] User not found. Total data rows searched: ${rows.length - 2}`);
			return null;
		}
		
		console.log(`[getUserFromSheet] User found:`, userRow);

		// rolesフィールドの安全なパース
		let roles: string[] = [];
		if (userRow[13]) {
			try {
				console.log(`[getUserFromSheet] Raw roles value: "${userRow[13]}"`);
				roles = JSON.parse(userRow[13]);
				if (!Array.isArray(roles)) {
					console.warn(`[getUserFromSheet] Roles is not an array, converting to array:`, roles);
					roles = [roles];
				}
			} catch (parseError) {
				console.error(`[getUserFromSheet] Failed to parse roles JSON: "${userRow[13]}"`, parseError);
				// JSON形式でない場合、文字列として扱う
				if (typeof userRow[13] === 'string' && userRow[13].trim()) {
					// カンマ区切りの文字列として扱う
					roles = userRow[13].split(',').map(role => role.trim()).filter(role => role.length > 0);
				} else {
					roles = [];
				}
			}
		}

		// _Userシートのスキーマに基づいてユーザー情報を構築
		// A: id, B: name, C: email, D: given_name, E: family_name, F: nickname, 
		// G: picture, H: email_verified, I: locale, J: created_at, K: updated_at, L: ?, M: ?, N: roles
		const user = {
			id: userRow[0] || '',
			name: userRow[1] || '',
			email: userRow[2] || '',
			given_name: userRow[3] || undefined,
			family_name: userRow[4] || undefined,
			nickname: userRow[5] || undefined,
			picture: userRow[6] || undefined,
			email_verified: userRow[7] === 'TRUE' || undefined,
			locale: userRow[8] || undefined,
			created_at: userRow[9] || '',
			updated_at: userRow[10] || '',
			roles: roles,
			last_login: userRow[12] || undefined
		};

		return user;
	} catch (error) {
		console.error('Error getting user from sheet:', error);
		return null;
	}
}