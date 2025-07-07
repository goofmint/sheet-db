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
		
		// ヘッダー行（1行目）と型定義行（2行目）をスキップして、3行目以降からユーザーを検索
		const userRow = rows.find((row: string[], index: number) => 
			index >= 2 && row[0] === userId
		);

		if (!userRow) {
			return null;
		}

		// _Userシートのスキーマに基づいてユーザー情報を構築
		// A: id, B: email, C: name, D: given_name, E: family_name, F: nickname, 
		// G: picture, H: email_verified, I: locale, J: roles, K: created_at, L: updated_at, M: last_login
		const user = {
			id: userRow[0] || '',
			email: userRow[1] || '',
			name: userRow[2] || undefined,
			given_name: userRow[3] || undefined,
			family_name: userRow[4] || undefined,
			nickname: userRow[5] || undefined,
			picture: userRow[6] || undefined,
			email_verified: userRow[7] === 'TRUE' || undefined,
			locale: userRow[8] || undefined,
			roles: userRow[9] ? JSON.parse(userRow[9]) : [],
			created_at: userRow[10] || '',
			updated_at: userRow[11] || '',
			last_login: userRow[12] || undefined
		};

		return user;
	} catch (error) {
		console.error('Error getting user from sheet:', error);
		return null;
	}
}