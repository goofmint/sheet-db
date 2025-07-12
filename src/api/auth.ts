import { OpenAPIHono } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { 
	getConfig, 
	getGoogleTokens, 
	isTokenValid, 
	getGoogleCredentials, 
	refreshAccessToken, 
	saveGoogleTokens,
	CONFIG_KEYS,
	type DatabaseConnection
} from '../google-auth';
import { getConfigFromSheet } from '../utils/sheet-helpers';
import { authStartRoute, authCallbackGetRoute, authCallbackPostRoute, logoutRoute } from '../api-routes';

type Bindings = {
	DB: D1Database;
	ASSETS: Fetcher;
};

// Auth0認証開始エンドポイント (OpenAPI)
export function registerAuthStartRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.openapi(authStartRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// クエリパラメータを確認（コールバックからのリダイレクトの場合）
			const { code, error } = c.req.valid('query');
			
			// 認証エラーがある場合
			if (error) {
				console.error('Auth0 authentication error:', error);
				return c.json({ 
					success: false,
					error: `Auth0 authentication error: ${error}` 
				}, 400);
			}
			
			// 認証コードがある場合（コールバックからのリダイレクト）
			if (code) {
				return await handleAuthCallback(c, db, code);
			}
			
			// 認証開始の場合
			// Auth0設定を取得
			const auth0Domain = await getConfig(db, 'auth0_domain');
			const auth0ClientId = await getConfig(db, 'auth0_client_id');
			const auth0Audience = await getConfig(db, 'auth0_audience');
			
			if (!auth0Domain || !auth0ClientId) {
				return c.json({ 
					success: false,
					error: 'Auth0 configuration not found. Please complete setup first.' 
				}, 400);
			}
			
			// リダイレクトURI（POST /api/auth/callback → GET /api/auth のリダイレクト）
			const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback`;
			console.log('Initial auth redirect URI:', redirectUri);
			
			// Stateを生成（後で検証に使用）
			const state = crypto.randomUUID();
			
			// Auth0認証URLを構築
			const params = new URLSearchParams({
				response_type: 'code',
				client_id: auth0ClientId,
				redirect_uri: redirectUri,
				scope: 'openid profile email',
				state: state // CSRF保護用
			});
			
			if (auth0Audience) {
				params.append('audience', auth0Audience);
			}
			
			const authUrl = `https://${auth0Domain}/authorize?${params.toString()}`;
			
			console.log('Redirecting to Auth0:', { authUrl, redirectUri });
			
			// Auth0認証画面にリダイレクト
			return c.redirect(authUrl);
			
		} catch (error) {
			console.error('Error in /api/auth:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false, error: errorMessage }, 500);
		}
	});
}

// Auth0認証コールバックエンドポイント（Auth0からのコールバック受信） (OpenAPI)
export function registerAuthCallbackGetRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.openapi(authCallbackGetRoute, async (c) => {
		try {
			// クエリパラメータを取得
			const { code, error, state } = c.req.valid('query');
			
			// GET /api/auth にリダイレクト（パラメータを保持）
			const redirectUrl = new URL('/api/auth', new URL(c.req.url).origin);
			
			if (error) {
				redirectUrl.searchParams.set('error', error);
			}
			if (code) {
				redirectUrl.searchParams.set('code', code);
			}
			if (state) {
				redirectUrl.searchParams.set('state', state);
			}
			
			console.log('Redirecting callback to /api/auth:', redirectUrl.toString());
			return c.redirect(redirectUrl.toString());
			
		} catch (error) {
			console.error('Error in /api/auth/callback:', error);
			return c.redirect('/api/auth?error=callback_error');
		}
	});
}

// POST /api/auth/callback エンドポイント（実際の認証処理） (OpenAPI)
export function registerAuthCallbackPostRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.openapi(authCallbackPostRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// リクエストボディから認証コードを取得
			const { code } = c.req.valid('json');
			
			// handleAuthCallback関数を使用して認証処理を実行
			return await handleAuthCallback(c, db, code);
			
		} catch (error) {
			console.error('Error in POST /api/auth/callback:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({
				success: false,
				error: `Authentication processing failed: ${errorMessage}`
			}, 500);
		}
	});
}

// POST /api/logout エンドポイント (OpenAPI)
export function registerLogoutRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.openapi(logoutRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Authorization ヘッダーからセッションIDを取得
			const authHeader = c.req.header('authorization');
			if (!authHeader) {
				return c.json({
					success: false,
					error: 'Authorization header is required'
				}, 401);
			}
			
			const sessionId = authHeader.replace(/^Bearer\s+/, '');
			if (!sessionId) {
				return c.json({
					success: false,
					error: 'Invalid authorization header format'
				}, 401);
			}
			
			// セッションを認証（ユーザーIDを取得するため）
			const authResult = await authenticateSession(db, sessionId);
			if (!authResult.valid) {
				// セッションが無効でも200を返す（要件通り）
				console.log('Session not found or invalid during logout:', authResult.error);
				return c.json({
					success: true,
					data: {}
				});
			}
			
			// _Sessionシートから該当セッションをクリア
			await clearSessionFromSheet(db, sessionId);
			
			console.log('User logged out successfully:', { sessionId, userId: authResult.userId });
			
			return c.json({
				success: true,
				data: {}
			});
			
		} catch (error) {
			console.error('Error in /api/logout:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({
				success: false,
				error: `Logout failed: ${errorMessage}`
			}, 500);
		}
	});
}

// セッション情報を_Sessionシートからクリアする関数
async function clearSessionFromSheet(db: DatabaseConnection, sessionId: string): Promise<void> {
	try {
		console.log('Clearing session from _Session sheet:', sessionId);
		
		// Get Google Sheets settings
		const spreadsheetId = await getConfig(db, 'spreadsheet_id');
		if (!spreadsheetId) {
			throw new Error('No spreadsheet selected');
		}
		
		// Get valid Google tokens
		let tokens = await getGoogleTokens(db);
		if (!tokens) {
			throw new Error('No valid Google token found');
		}
		
		// トークンの有効性を確認
		const isValid = await isTokenValid(db);
		if (!isValid) {
			const credentials = await getGoogleCredentials(db);
			if (credentials && tokens.refresh_token) {
				tokens = await refreshAccessToken(tokens.refresh_token, credentials);
				await saveGoogleTokens(db, tokens);
			} else {
				throw new Error('Failed to refresh Google token');
			}
		}
		
		// _Sessionシートからセッション情報を取得
		const sessionResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Session!A:F`,
			{
				headers: {
					'Authorization': `Bearer ${tokens.access_token}`,
					'Content-Type': 'application/json',
				}
			}
		);
		
		if (!sessionResponse.ok) {
			throw new Error(`Failed to fetch session data: ${sessionResponse.status}`);
		}
		
		const sessionData = await sessionResponse.json() as any;
		const sessions = sessionData.values || [];
		
		// セッションIDを検索（3行目から検索：1行目はヘッダー、2行目は型定義）
		const sessionRowIndex = sessions.findIndex((row: string[], index: number) => 
			index >= 2 && row[0] === sessionId
		);
		
		if (sessionRowIndex === -1) {
			// セッションが見つからない場合もエラーにしない（要件通り）
			console.log('Session not found in _Session sheet, nothing to clear:', sessionId);
			return;
		}
		
		// 該当行を特定（シート行番号に変換）
		const targetRow = sessionRowIndex + 1;
		
		// 行のデータをクリア（行の削除ではなくクリアにしてコンフリクトを回避）
		const clearData = ['', '', '', '', '', '']; // 6列すべてクリア
		
		const updateResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Session!A${targetRow}:F${targetRow}?valueInputOption=RAW`,
			{
				method: 'PUT',
				headers: {
					'Authorization': `Bearer ${tokens.access_token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					values: [clearData]
				})
			}
		);
		
		if (!updateResponse.ok) {
			const errorText = await updateResponse.text();
			console.error('Failed to clear session data:', updateResponse.status, errorText);
			throw new Error(`Failed to clear session data: ${updateResponse.status}`);
		}
		
		console.log('Session data cleared successfully from _Session sheet');
		
	} catch (error) {
		console.error('Error clearing session from sheet:', error);
		throw error;
	}
}

// 認証コールバック処理関数
async function handleAuthCallback(c: any, db: DatabaseConnection, code: string): Promise<any> {
	try {
		console.log('Processing auth callback with code');
		
		// Auth0設定を取得
		const auth0Domain = await getConfig(db, 'auth0_domain');
		const auth0ClientId = await getConfig(db, 'auth0_client_id');
		const auth0ClientSecret = await getConfig(db, 'auth0_client_secret');
		const auth0Audience = await getConfig(db, 'auth0_audience');
		
		if (!auth0Domain || !auth0ClientId || !auth0ClientSecret) {
			return c.json({
				success: false,
				error: 'Auth0 configuration not found. Please complete setup first.'
			}, 400);
		}
		
		// リダイレクトURI
		const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback`;
		console.log('Token exchange redirect URI:', redirectUri);
		console.log('Request headers:', {
			host: c.req.header('host'),
			origin: c.req.header('origin'),
			referer: c.req.header('referer')
		});
		
		// 認証コードをアクセストークンに交換
		const tokenResponse = await fetch(`https://${auth0Domain}/oauth/token`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				grant_type: 'authorization_code',
				client_id: auth0ClientId,
				client_secret: auth0ClientSecret,
				code: code,
				redirect_uri: redirectUri,
				...(auth0Audience && { audience: auth0Audience })
			})
		});
		
		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();
			console.error('Token exchange failed:', {
				status: tokenResponse.status,
				error: errorText,
				redirectUri: redirectUri,
				auth0Domain: auth0Domain,
				clientId: auth0ClientId
			});
			return c.json({
				success: false,
				error: 'Failed to exchange authorization code for tokens',
				details: errorText
			}, 400);
		}
		
		const tokens = await tokenResponse.json() as any;
		console.log('Received tokens from Auth0');
		
		// ユーザー情報を取得
		const userInfoResponse = await fetch(`https://${auth0Domain}/userinfo`, {
			headers: {
				'Authorization': `Bearer ${tokens.access_token}`
			}
		});
		
		if (!userInfoResponse.ok) {
			const errorText = await userInfoResponse.text();
			console.error('User info fetch failed:', userInfoResponse.status, errorText);
			return c.json({
				success: false,
				error: 'Failed to fetch user information from Auth0'
			}, 400);
		}
		
		const userInfo = await userInfoResponse.json() as any;
		console.log('Received user info from Auth0:', { sub: userInfo.sub, email: userInfo.email });
		
		// ユーザー情報を_Userシートに保存
		const savedUser = await saveUserToSheet(db, userInfo);
		
		// セッション情報を_Sessionシートに保存
		const sessionId = crypto.randomUUID();
		await saveSessionToSheet(db, sessionId, userInfo.sub, tokens.access_token);
		
		// JSONレスポンスを返す
		return c.json({
			success: true,
			data: {
				sessionId: sessionId,
				user: savedUser
			}
		});
		
	} catch (error) {
		console.error('Error in handleAuthCallback:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return c.json({
			success: false,
			error: `Authentication failed: ${errorMessage}`
		}, 500);
	}
}

// ユーザー情報を_Userシートに保存する関数
async function saveUserToSheet(db: DatabaseConnection, userInfo: any): Promise<any> {
	try {
		console.log('Saving user to _User sheet:', userInfo.sub);
		
		// Get Google Sheets settings
		const spreadsheetId = await getConfig(db, 'spreadsheet_id');
		if (!spreadsheetId) {
			throw new Error('No spreadsheet selected');
		}
		
		// Get valid Google tokens
		let tokens = await getGoogleTokens(db);
		if (!tokens) {
			throw new Error('No valid Google token found');
		}
		
		// トークンの有効性を確認
		const isValid = await isTokenValid(db);
		if (!isValid) {
			const credentials = await getGoogleCredentials(db);
			if (credentials && tokens.refresh_token) {
				tokens = await refreshAccessToken(tokens.refresh_token, credentials);
				await saveGoogleTokens(db, tokens);
			} else {
				throw new Error('Failed to refresh Google token');
			}
		}
		
		// 現在の日時
		const now = new Date().toISOString();
		
		// ユーザーデータを準備（_Userシートのスキーマに合わせる）
		const userId = userInfo.sub || '';
		const userData = [
			userId,                                // id
			userInfo.name || '',                   // name
			userInfo.email || '',                  // email
			userInfo.given_name || '',             // given_name
			userInfo.family_name || '',            // family_name
			userInfo.nickname || '',               // nickname
			userInfo.picture || '',                // picture
			userInfo.email_verified ? 'TRUE' : 'FALSE', // email_verified
			userInfo.locale || '',                 // locale
			now,                                   // created_at
			now,                                   // updated_at
			'FALSE',                               // public_read
			'FALSE',                               // public_write
			'[]',                                  // role_read
			'[]',                                  // role_write
			JSON.stringify([userId]),              // user_read: 自分だけ読み取り可能
			JSON.stringify([userId])               // user_write: 自分だけ書き込み可能
		];
		
		// 既存ユーザーをチェック（全列を取得）
		const existingUserResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A:Q`,
			{
				headers: {
					'Authorization': `Bearer ${tokens.access_token}`,
					'Content-Type': 'application/json',
				}
			}
		);
		
		let targetRow = 3; // 3行目から（1行目はヘッダー、2行目は型定義）
		
		if (existingUserResponse.ok) {
			const existingData = await existingUserResponse.json() as any;
			const values = existingData.values || [];
			
			// 既存ユーザーを検索
			const userRowIndex = values.findIndex((row: string[], index: number) => 
				index >= 2 && row[0] === userInfo.sub
			);
			
			if (userRowIndex !== -1) {
				targetRow = userRowIndex + 1; // シート行番号に変換
				const existingRow = values[userRowIndex];
				
				// 既存ユーザーの場合、権限設定と作成日時を保持
				userData[9] = existingRow[9] || now;  // created_at保持
				userData[11] = existingRow[11] || 'FALSE';  // public_read保持
				userData[12] = existingRow[12] || 'FALSE';  // public_write保持
				userData[13] = existingRow[13] || '[]';     // role_read保持
				userData[14] = existingRow[14] || '[]';     // role_write保持
				userData[15] = existingRow[15] || JSON.stringify([userId]);  // user_read保持（なければデフォルト）
				userData[16] = existingRow[16] || JSON.stringify([userId]);  // user_write保持（なければデフォルト）
				
				console.log('Updating existing user at row:', targetRow);
			} else {
				// 新規ユーザーの場合、最後の行に追加
				targetRow = values.length + 1;
				console.log('Adding new user at row:', targetRow);
			}
		}
		
		// データを保存（カラム数が17個になったのでQまで）
		const updateResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A${targetRow}:Q${targetRow}?valueInputOption=RAW`,
			{
				method: 'PUT',
				headers: {
					'Authorization': `Bearer ${tokens.access_token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					values: [userData]
				})
			}
		);
		
		if (!updateResponse.ok) {
			const errorText = await updateResponse.text();
			console.error('Failed to save user data:', updateResponse.status, errorText);
			throw new Error(`Failed to save user data: ${updateResponse.status}`);
		}
		
		console.log('User data saved successfully to _User sheet');
		
		// 保存されたユーザー情報を返す
		return {
			id: userId,
			name: userInfo.name || '',
			email: userInfo.email || '',
			given_name: userInfo.given_name || '',
			family_name: userInfo.family_name || '',
			nickname: userInfo.nickname || '',
			picture: userInfo.picture || '',
			email_verified: userInfo.email_verified || false,
			locale: userInfo.locale || '',
			created_at: userData[9], // created_at
			updated_at: userData[10], // updated_at
			public_read: userData[11] === 'TRUE',
			public_write: userData[12] === 'TRUE',
			role_read: JSON.parse(userData[13]),
			role_write: JSON.parse(userData[14]),
			user_read: JSON.parse(userData[15]),   // 自分だけ読み取り可能（デフォルト）
			user_write: JSON.parse(userData[16])   // 自分だけ書き込み可能（デフォルト）
		};
		
	} catch (error) {
		console.error('Error saving user to sheet:', error);
		throw error;
	}
}

// Function to save session information to _Session sheet
async function saveSessionToSheet(db: DatabaseConnection, sessionId: string, userId: string, accessToken: string): Promise<void> {
	try {
		console.log('Saving session to _Session sheet:', sessionId);
		
		// Get Google Sheets settings
		const spreadsheetId = await getConfig(db, 'spreadsheet_id');
		if (!spreadsheetId) {
			throw new Error('No spreadsheet selected');
		}
		
		// Get valid Google tokens
		let tokens = await getGoogleTokens(db);
		if (!tokens) {
			throw new Error('No valid Google token found');
		}
		
		// Check token validity and refresh if needed
		const isValid = await isTokenValid(db);
		if (!isValid) {
			const credentials = await getGoogleCredentials(db);
			if (credentials && tokens.refresh_token) {
				tokens = await refreshAccessToken(tokens.refresh_token, credentials);
				await saveGoogleTokens(db, tokens);
			} else {
				throw new Error('Failed to refresh Google token');
			}
		}
		
		// Get session expiration time from _Config sheet (runtime config)
		const now = new Date();
		const sessionExpiredSeconds = await getConfigFromSheet('SESSION_EXPIRED_SECONDS', spreadsheetId, tokens.access_token);
		let expiredSeconds = sessionExpiredSeconds ? parseInt(sessionExpiredSeconds, 10) : 3600; // Default: 1 hour
		
		// Validate session expiration time (1 minute to 30 days range)
		if (isNaN(expiredSeconds) || expiredSeconds < 60 || expiredSeconds > 2592000) {
			console.warn('Invalid session expiration time:', sessionExpiredSeconds, 'using default 3600 seconds');
			expiredSeconds = 3600; // Default: 1 hour
		}
		
		const expiresAt = new Date(now.getTime() + expiredSeconds * 1000);
		
		// Prepare session data
		const sessionData = [
			sessionId,                             // id
			userId,                                // user_id
			accessToken.substring(0, 20) + '...', // token (partial for security)
			expiresAt.toISOString(),              // expires_at
			now.toISOString(),                    // created_at
			now.toISOString()                     // updated_at
		];
		
		// Append to the last row
		const appendResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Session!A:F:append?valueInputOption=RAW`,
			{
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${tokens.access_token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					values: [sessionData]
				})
			}
		);
		
		if (!appendResponse.ok) {
			const errorText = await appendResponse.text();
			console.error('Failed to save session data:', appendResponse.status, errorText);
			throw new Error(`Failed to save session data: ${appendResponse.status}`);
		}
		
		console.log('Session data saved successfully to _Session sheet');
		
	} catch (error) {
		console.error('Error saving session to sheet:', error);
		throw error;
	}
}

// セッション認証のヘルパー関数
export async function authenticateSession(db: DatabaseConnection, sessionId: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
	try {
		if (!sessionId) {
			return { valid: false, error: 'Session ID is required' };
		}

		// Get Google Sheets settings
		const spreadsheetId = await getConfig(db, 'spreadsheet_id');
		if (!spreadsheetId) {
			return { valid: false, error: 'No spreadsheet configured' };
		}

		// Get valid Google tokens
		let tokens = await getGoogleTokens(db);
		if (!tokens) {
			return { valid: false, error: 'No valid Google token found' };
		}

		// トークンの有効性を確認
		const isValid = await isTokenValid(db);
		if (!isValid) {
			const credentials = await getGoogleCredentials(db);
			if (credentials && tokens.refresh_token) {
				tokens = await refreshAccessToken(tokens.refresh_token, credentials);
				await saveGoogleTokens(db, tokens);
			} else {
				return { valid: false, error: 'Failed to refresh Google token' };
			}
		}

		// _Sessionシートからセッション情報を取得
		const sessionResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Session!A:F`,
			{
				headers: {
					'Authorization': `Bearer ${tokens.access_token}`,
					'Content-Type': 'application/json',
				}
			}
		);

		if (!sessionResponse.ok) {
			return { valid: false, error: 'Failed to fetch session data' };
		}

		const sessionData = await sessionResponse.json() as any;
		const sessions = sessionData.values || [];

		// セッションIDを検索（3行目から検索：1行目はヘッダー、2行目は型定義）
		const sessionRow = sessions.find((row: string[], index: number) => 
			index >= 2 && row[0] === sessionId
		);

		if (!sessionRow) {
			return { valid: false, error: 'Session not found' };
		}

		// セッションの有効期限をチェック
		const expiresAt = new Date(sessionRow[3]); // expires_at列
		const now = new Date();

		if (now > expiresAt) {
			return { valid: false, error: 'Session expired' };
		}

		// 有効なセッション
		return { 
			valid: true, 
			userId: sessionRow[1] // user_id列
		};

	} catch (error) {
		console.error('Error authenticating session:', error);
		return { valid: false, error: 'Authentication failed' };
	}
}

// 全ての認証ルートを登録する関数
export function registerAuthRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
	registerAuthStartRoute(app);
	registerAuthCallbackGetRoute(app);
	registerAuthCallbackPostRoute(app);
	registerLogoutRoute(app);
}