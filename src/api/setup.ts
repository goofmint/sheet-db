import { OpenAPIHono } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import {
	getConfig,
	setConfig,
	getGoogleTokens,
	isTokenValid,
	getGoogleCredentials,
	refreshAccessToken,
	saveGoogleTokens,
	isSetupCompleted,
	resetSetupCompleted
} from '../google-auth';
import { SheetsSetupManager, SetupProgress } from '../sheet-schema';
import { setupHtml } from '../setup-html';
import { spreadsheetSelectionHtml } from '../spreadsheet-selection-html';

type Bindings = {
	DB: D1Database;
};

// GET /setup - メインセットアップページ
export function registerSetupMainRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.get('/setup', async (c) => {
		try {
			const db = drizzle(c.env.DB);

			// セットアップ完了チェック
			const setupCompleted = await isSetupCompleted(db);
			if (setupCompleted) {
				return c.html(`
					<div style="max-width: 600px; margin: 50px auto; padding: 20px; font-family: Arial, sans-serif;">
						<h1 style="color: #333;">🚫 セットアップは既に完了しています</h1>
						<p>このアプリケーションのセットアップは既に完了しています。</p>
						<p>再設定を行いたい場合は、以下の手順に従ってください：</p>
						<ol style="line-height: 1.6;">
							<li>管理者に連絡してsetup_completedフラグをリセットしてもらう</li>
							<li>または、<code>POST /api/reset-setup</code> エンドポイントを呼び出す</li>
						</ol>
						<div style="margin-top: 30px;">
							<div style="margin-bottom: 20px;">
								<label for="reset-token-input" style="display: block; margin-bottom: 5px; font-weight: bold;">リセットトークン:</label>
								<input type="password" id="reset-token-input" placeholder="セットアップ時に設定したリセットトークンを入力" style="width: 300px; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
							</div>
							<button onclick="resetSetup()" style="background-color: #ea4335; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
								⚠️ セットアップをリセットする
							</button>
							<a href="/" style="margin-left: 20px; color: #1a73e8; text-decoration: none;">← ホームに戻る</a>
						</div>
					</div>
					<script>
						function resetSetup() {
							const token = document.getElementById('reset-token-input').value;
							if (!token) {
								alert('リセットトークンを入力してください。');
								return;
							}
							
							if (confirm('セットアップをリセットしますか？\\\\n\\\\n現在の設定がすべて削除され、最初からセットアップが必要になります。')) {
								fetch('/api/reset-setup', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ token: token })
								})
								.then(response => response.json())
								.then(data => {
									if (data.success) {
										alert('セットアップがリセットされました。ページを再読み込みします。');
										window.location.reload();
									} else {
										alert('リセットに失敗しました: ' + data.error);
									}
								})
								.catch(error => {
									alert('エラーが発生しました: ' + error.message);
								});
							}
						}
					</script>
				`);
			}

			// 既存の設定を確認
			const credentials = await getGoogleCredentials(db);
			const authCompleted = await getConfig(db, 'google_auth_completed');
			const connected = c.req.query('connected') === 'true';
			const spreadsheetSelected = c.req.query('spreadsheet') === 'selected';

			// Auth0設定を取得
			const auth0Domain = await getConfig(db, 'auth0_domain');
			const auth0ClientId = await getConfig(db, 'auth0_client_id');
			const auth0ClientSecret = await getConfig(db, 'auth0_client_secret');
			const auth0Audience = await getConfig(db, 'auth0_audience');
			const resetToken = await getConfig(db, 'reset_token');

			// スプレッドシート設定を取得
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			const spreadsheetName = await getConfig(db, 'spreadsheet_name');
			const spreadsheetUrl = await getConfig(db, 'spreadsheet_url');
			const sheetsInitialized = await getConfig(db, 'sheets_initialized');
			const sheetSetupStatus = await getConfig(db, 'sheet_setup_status');
			const sheetSetupProgress = await getConfig(db, 'sheet_setup_progress');

			// 設定状況をHTMLに埋め込む
			const configData = {
				hasCredentials: !!credentials,
				clientId: credentials?.client_id || '',
				authCompleted: authCompleted === 'true',
				connected: connected,
				spreadsheetSelected: spreadsheetSelected,
				// Auth0設定
				auth0Domain: auth0Domain || '',
				auth0ClientId: auth0ClientId || '',
				auth0ClientSecret: auth0ClientSecret || '',
				auth0Audience: auth0Audience || '',
				resetToken: resetToken || '',
				hasAuth0Config: !!(auth0Domain && auth0ClientId && auth0ClientSecret),
				// スプレッドシート設定
				spreadsheetId: spreadsheetId || '',
				spreadsheetName: spreadsheetName || '',
				spreadsheetUrl: spreadsheetUrl || '',
				hasSpreadsheet: !!spreadsheetId,
				sheetsInitialized: sheetsInitialized === 'true',
				sheetSetupStatus: sheetSetupStatus || '',
				sheetSetupProgress: sheetSetupProgress || ''
			};

			// HTMLテンプレートに設定データを注入
			const modifiedHtml = setupHtml.replace(
				'<script>',
				`<script>
					window.setupConfig = ${JSON.stringify(configData)};`
			);

			return c.html(modifiedHtml);
		} catch (error) {
			console.error('Error in /setup:', error);
			return c.html(setupHtml);
		}
	});
}

// GET /setup/connect - スプレッドシート選択ページ
export function registerSetupConnectRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.get('/setup/connect', async (c) => {
		try {
			const db = drizzle(c.env.DB);

			// セットアップ完了チェック
			const setupCompleted = await isSetupCompleted(db);
			if (setupCompleted) {
				return c.json({
					error: 'Setup is already completed. Please reset setup_completed flag to reconfigure.'
				}, 403);
			}

			// OAuthコールバックの処理（codeパラメータが存在する場合）
			const code = c.req.query('code');
			const error = c.req.query('error');

			if (error) {
				console.error('OAuth error:', error);
				return c.html(`
					<div style="max-width: 600px; margin: 50px auto; padding: 20px; font-family: Arial, sans-serif;">
						<h1 style="color: #333;">❌ 認証エラー</h1>
						<p>Google認証中にエラーが発生しました: ${error}</p>
						<a href="/setup" style="color: #1a73e8; text-decoration: none;">← セットアップページに戻る</a>
					</div>
				`);
			}

			if (code) {
				console.log('Processing OAuth callback with code:', code.substring(0, 10) + '...');

				try {
					// クライアント情報を取得
					const credentials = await getGoogleCredentials(db);
					if (!credentials) {
						throw new Error('Google credentials not found');
					}

					// 認証コードをアクセストークンに交換
					const tokenUrl = 'https://oauth2.googleapis.com/token';
					const redirectUri = `${new URL(c.req.url).origin}/setup/connect`;

					const response = await fetch(tokenUrl, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
						},
						body: new URLSearchParams({
							code: code,
							client_id: credentials.client_id,
							client_secret: credentials.client_secret,
							redirect_uri: redirectUri,
							grant_type: 'authorization_code',
						}).toString(),
					});

					if (!response.ok) {
						const errorText = await response.text();
						console.error('Token exchange failed:', response.status, errorText);
						throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
					}

					const tokens = await response.json() as any;
					console.log('Successfully obtained tokens');

					// トークンを保存
					await saveGoogleTokens(db, tokens);
					await setConfig(db, 'google_auth_completed', 'true');

					// スプレッドシート選択ページにリダイレクト
					return c.redirect('/setup?connected=true');

				} catch (exchangeError) {
					console.error('Error exchanging code for tokens:', exchangeError);
					return c.html(`
						<div style="max-width: 600px; margin: 50px auto; padding: 20px; font-family: Arial, sans-serif;">
							<h1 style="color: #333;">❌ 認証処理エラー</h1>
							<p>認証コードの処理中にエラーが発生しました。</p>
							<p style="color: #666; font-size: 14px;">エラー: ${exchangeError instanceof Error ? exchangeError.message : '不明なエラー'}</p>
							<a href="/setup" style="color: #1a73e8; text-decoration: none;">← セットアップページに戻る</a>
						</div>
					`);
				}
			}

			// Google認証が完了しているかチェック
			const authCompleted = await getConfig(db, 'google_auth_completed');
			if (authCompleted !== 'true') {
				return c.html(`
					<div style="max-width: 600px; margin: 50px auto; padding: 20px; font-family: Arial, sans-serif;">
						<h1 style="color: #333;">🔗 Google認証が必要です</h1>
						<p>スプレッドシートを選択するには、まずGoogle認証を完了してください。</p>
						<a href="/setup" style="color: #1a73e8; text-decoration: none;">← セットアップページに戻る</a>
					</div>
				`);
			}

			// 有効なトークンを確認し、必要に応じてリフレッシュ
			const isValid = await isTokenValid(db);
			if (!isValid) {
				// トークンが無効な場合、リフレッシュを試行
				const currentTokens = await getGoogleTokens(db);
				const credentials = await getGoogleCredentials(db);

				if (!currentTokens?.refresh_token || !credentials) {
					return c.html(`
						<div style="max-width: 600px; margin: 50px auto; padding: 20px; font-family: Arial, sans-serif;">
							<h1 style="color: #333;">🔒 認証が無効です</h1>
							<p>トークンが無効で、リフレッシュトークンもありません。再度Google認証を行ってください。</p>
							<a href="/setup" style="color: #1a73e8; text-decoration: none;">← セットアップページに戻る</a>
						</div>
					`);
				}

				try {
					const newTokens = await refreshAccessToken(currentTokens.refresh_token, credentials);
					await saveGoogleTokens(db, newTokens);
					console.log('Token refreshed successfully for /setup/connect');
				} catch (refreshError) {
					console.error('Failed to refresh token in /setup/connect:', refreshError);
					return c.html(`
						<div style="max-width: 600px; margin: 50px auto; padding: 20px; font-family: Arial, sans-serif;">
							<h1 style="color: #333;">🔒 認証が無効です</h1>
							<p>トークンのリフレッシュに失敗しました。再度Google認証を行ってください。</p>
							<p style="color: #666; font-size: 14px;">エラー: ${refreshError instanceof Error ? refreshError.message : '不明なエラー'}</p>
							<a href="/setup" style="color: #1a73e8; text-decoration: none;">← セットアップページに戻る</a>
						</div>
					`);
				}
			}

			// スプレッドシート選択ページを表示
			return c.html(spreadsheetSelectionHtml);

		} catch (error) {
			console.error('Error in /setup/connect:', error);
			return c.html(`
				<div style="max-width: 600px; margin: 50px auto; padding: 20px; font-family: Arial, sans-serif;">
					<h1 style="color: #333;">❌ エラーが発生しました</h1>
					<p>スプレッドシート選択ページの読み込み中にエラーが発生しました。</p>
					<a href="/setup" style="color: #1a73e8; text-decoration: none;">← セットアップページに戻る</a>
				</div>
			`);
		}
	});
}

// POST /api/setup/auth - Google OAuth URL生成
export function registerGoogleAuthRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.post('/api/setup/auth', async (c) => {
		try {
			const body = await c.req.json();
			const { clientId, clientSecret } = body;

			if (!clientId) {
				return c.json({
					success: false,
					error: 'Google Client ID is required'
				}, 400);
			}

			const db = drizzle(c.env.DB);

			// クライアント情報を一時保存
			await setConfig(db, 'google_client_id', clientId);
			if (clientSecret && clientSecret !== '[SAVED]') {
				await setConfig(db, 'google_client_secret', clientSecret);
			}

			// OAuth URLを生成
			const redirectUri = `${new URL(c.req.url).origin}/setup/connect`;
			const scopes = [
				'https://www.googleapis.com/auth/spreadsheets',
				'https://www.googleapis.com/auth/drive.readonly'
			].join(' ');

			const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
				new URLSearchParams({
					client_id: clientId,
					redirect_uri: redirectUri,
					response_type: 'code',
					scope: scopes,
					access_type: 'offline',
					prompt: 'consent'
				}).toString();

			return c.json({
				success: true,
				authUrl: authUrl
			});

		} catch (error) {
			console.error('Error in POST /api/setup:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false, error: errorMessage }, 500);
		}
	});
}

// POST /api/setup - セットアップ情報保存
export function registerApiSetupRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.post('/api/setup', async (c) => {
		try {
			const body = await c.req.json();
			const db = drizzle(c.env.DB);

			// デバッグ: 受信したデータをログ出力（リセットトークンは部分的にマスク）
			console.log('Received setup data keys:', Object.keys(body));
			console.log('Reset token provided:', body.resetToken !== undefined);
			console.log('Reset token length:', body.resetToken ? body.resetToken.length : 'undefined');
			console.log('Reset token type:', typeof body.resetToken);

			// マスクされた値かどうかをチェック
			const isMaskedToken = body.resetToken && /^•+$/.test(body.resetToken);
			console.log('Reset token is masked:', isMaskedToken);

			if (body.resetToken && !isMaskedToken) {
				console.log('Reset token preview:', body.resetToken.substring(0, 4) + '...' + body.resetToken.substring(-4));
			}

			// リセットトークンのバリデーション
			// 新しいリセットトークンが提供された場合のみ検証
			if (body.resetToken !== undefined) {
				// マスクされた値の場合はエラー
				if (isMaskedToken) {
					console.log('Masked reset token received - rejecting');
					return c.json({
						success: false,
						error: 'Masked reset token received. Please provide a valid token.'
					}, 400);
				}

				if (!body.resetToken || body.resetToken.length < 16) {
					console.log('Reset token validation failed');
					return c.json({
						success: false,
						error: 'Reset token must be at least 16 characters long'
					}, 400);
				}
				// リセットトークンを保存
				console.log('Saving new reset token');
				await setConfig(db, 'reset_token', body.resetToken);
			} else {
				// リセットトークンが提供されていない場合、既存のトークンを確認
				console.log('No reset token provided, checking existing token');
				const existingToken = await getConfig(db, 'reset_token');
				if (!existingToken || existingToken.length < 16) {
					console.log('No valid reset token found');
					return c.json({
						success: false,
						error: 'Reset token is required and must be at least 16 characters long'
					}, 400);
				}
				console.log('Using existing reset token');
			}

			// Auth0設定を保存
			if (body.auth0Domain) {
				await setConfig(db, 'auth0_domain', body.auth0Domain);
			}
			if (body.auth0ClientId) {
				await setConfig(db, 'auth0_client_id', body.auth0ClientId);
			}
			if (body.auth0ClientSecret) {
				await setConfig(db, 'auth0_client_secret', body.auth0ClientSecret);
			}
			if (body.auth0Audience) {
				await setConfig(db, 'auth0_audience', body.auth0Audience);
			}

			// スプレッドシート情報を保存（存在する場合）
			if (body.spreadsheetId) {
				await setConfig(db, 'spreadsheet_id', body.spreadsheetId);
			}
			if (body.spreadsheetName) {
				await setConfig(db, 'spreadsheet_name', body.spreadsheetName);
			}
			if (body.spreadsheetUrl) {
				await setConfig(db, 'spreadsheet_url', body.spreadsheetUrl);
			}

			// セットアップ完了フラグを設定
			await setConfig(db, 'setup_completed', 'true');

			return c.json({ success: true });

		} catch (error) {
			console.error('Error in /api/setup:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false, error: errorMessage }, 500);
		}
	});
}

// POST /api/reset-setup - セットアップリセット
export function registerApiResetSetupRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.post('/api/reset-setup', async (c) => {
		try {
			const body = await c.req.json();
			const db = drizzle(c.env.DB);

			// リセットトークンの確認
			const storedToken = await getConfig(db, 'reset_token');
			if (!storedToken) {
				return c.json({
					success: false,
					error: 'No reset token is configured. Setup may not be completed yet.'
				}, 400);
			}

			if (!body.token || body.token !== storedToken) {
				return c.json({
					success: false,
					error: 'Invalid reset token provided'
				}, 401);
			}

			// セットアップ完了フラグをリセット
			await resetSetupCompleted(db);

			return c.json({ success: true, message: 'Setup has been reset successfully' });

		} catch (error) {
			console.error('Error in /api/reset-setup:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false, error: errorMessage }, 500);
		}
	});
}

// GET /api/spreadsheets - スプレッドシート一覧取得
export function registerApiSpreadsheetsRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.get('/api/spreadsheets', async (c) => {
		try {
			const db = drizzle(c.env.DB);

			// 有効なトークンを取得
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ error: 'No valid token found. Please re-authenticate.' }, 401);
			}

			// トークンの有効性を確認し、必要に応じてリフレッシュ
			const isValid = await isTokenValid(db);
			if (!isValid) {
				console.log('Token is invalid, attempting refresh...');
				const credentials = await getGoogleCredentials(db);
				if (!credentials || !tokens.refresh_token) {
					console.error('Missing credentials or refresh token');
					return c.json({
						error: 'Authentication required. Missing refresh token or credentials.'
					}, 401);
				}

				try {
					const newTokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, newTokens);
					tokens = newTokens; // 新しいトークンで更新
					console.log('Token refreshed successfully for API request');
				} catch (refreshError) {
					console.error('Token refresh failed:', refreshError);
					return c.json({
						error: `Token refresh failed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}. Re-authentication required.`
					}, 401);
				}
			}

			// Google Drive APIでスプレッドシートを取得
			const driveApiUrl = "https://www.googleapis.com/drive/v3/files?" +
				"q=mimeType='application/vnd.google-apps.spreadsheet'" +
				"&fields=files(id,name,webViewLink,modifiedTime,ownedByMe,owners)" +
				"&orderBy=modifiedTime desc" +
				"&pageSize=100";

			const response = await fetch(driveApiUrl, {
				headers: {
					'Authorization': `Bearer ${tokens.access_token}`,
					'Content-Type': 'application/json',
				}
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('Google Drive API error:', response.status, errorText);

				// 認証エラーの場合は特別な処理
				if (response.status === 401) {
					throw new Error('Google API authentication failed. Please re-authenticate.');
				}

				throw new Error(`Google Drive API error: ${response.status} ${errorText}`);
			}

			const data = await response.json() as any;
			return c.json(data);

		} catch (error) {
			console.error('Error in /api/spreadsheets:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ error: errorMessage }, 500);
		}
	});
}

// POST /api/spreadsheets/select - スプレッドシート選択
export function registerApiSpreadsheetsSelectRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.post('/api/spreadsheets/select', async (c) => {
		try {
			const body = await c.req.json();
			const db = drizzle(c.env.DB);

			const { spreadsheetId, spreadsheetName, spreadsheetUrl } = body;

			if (!spreadsheetId || !spreadsheetName) {
				return c.json({
					success: false,
					error: 'Spreadsheet ID and name are required'
				}, 400);
			}

			// 現在選択されているスプレッドシートIDを確認
			const currentSpreadsheetId = await getConfig(db, 'spreadsheet_id');
			const isNewSpreadsheet = currentSpreadsheetId !== spreadsheetId;

			console.log('Selecting spreadsheet:', {
				spreadsheetId,
				spreadsheetName,
				isNewSpreadsheet,
				currentSpreadsheetId
			});

			if (isNewSpreadsheet) {
				console.log('Previous sheet setup status before reset:', {
					currentSheetSetupStatus: await getConfig(db, 'sheet_setup_status'),
					currentSheetsInitialized: await getConfig(db, 'sheets_initialized')
				});
			}

			// 新しいスプレッドシートが選択された場合、シート関連の状態をリセット
			if (isNewSpreadsheet) {
				console.log('New spreadsheet selected, resetting sheet setup status');

				// シート初期化関連の状態をリセット
				await setConfig(db, 'sheet_setup_status', '');
				await setConfig(db, 'sheets_initialized', '');
				await setConfig(db, 'sheet_setup_progress', '');

				console.log('Sheet setup status reset for new spreadsheet');
			}

			// スプレッドシート情報をConfigテーブルに保存
			await setConfig(db, 'spreadsheet_id', spreadsheetId);
			await setConfig(db, 'spreadsheet_name', spreadsheetName);
			if (spreadsheetUrl) {
				await setConfig(db, 'spreadsheet_url', spreadsheetUrl);
			}

			return c.json({
				success: true,
				resetSheetStatus: isNewSpreadsheet
			});

		} catch (error) {
			console.error('Error in /api/spreadsheets/select:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false, error: errorMessage }, 500);
		}
	});
}

// POST /api/setup/sheets - シートセットアップ開始
export function registerApiSetupSheetsRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.post('/api/setup/sheets', async (c) => {
		try {
			const db = drizzle(c.env.DB);

			// 必要な情報を取得
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ error: 'No spreadsheet selected' }, 400);
			}

			// 有効なトークンを取得
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ error: 'No valid token found. Please re-authenticate.' }, 401);
			}

			// トークンの有効性を確認し、必要に応じてリフレッシュ
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (!credentials || !tokens.refresh_token) {
					return c.json({
						error: 'Authentication required. Missing refresh token or credentials.'
					}, 401);
				}

				try {
					const newTokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, newTokens);
					tokens = newTokens;
				} catch (refreshError) {
					return c.json({
						error: `Token refresh failed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}. Re-authentication required.`
					}, 401);
				}
			}

			// セットアップ進行状況をConfigテーブルに保存するためのID
			const setupId = crypto.randomUUID();
			await setConfig(db, 'sheet_setup_id', setupId);
			await setConfig(db, 'sheet_setup_status', 'running');
			await setConfig(db, 'sheet_setup_progress', JSON.stringify({
				currentSheet: '',
				currentStep: '初期化中...',
				completedSheets: [],
				totalSheets: 4,
				progress: 0,
				status: 'running'
			}));

			// シートセットアップを非同期で実行
			c.executionCtx.waitUntil(
				setupSheetsAsync(spreadsheetId, tokens.access_token, db)
			);

			return c.json({
				success: true,
				setupId: setupId,
				message: 'Sheet setup started. Use /api/setup/sheets/progress to check progress.'
			});

		} catch (error) {
			console.error('Error in /api/setup/sheets:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false, error: errorMessage }, 500);
		}
	});
}

// GET /api/setup/sheets/progress - シートセットアップ進行状況確認
export function registerApiSetupSheetsProgressRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.get('/api/setup/sheets/progress', async (c) => {
		try {
			const db = drizzle(c.env.DB);

			const setupId = await getConfig(db, 'sheet_setup_id');
			const status = await getConfig(db, 'sheet_setup_status');
			const progressData = await getConfig(db, 'sheet_setup_progress');

			if (!setupId) {
				return c.json({ error: 'No setup in progress' }, 404);
			}

			const progress = progressData ? JSON.parse(progressData) : null;

			return c.json({
				setupId: setupId,
				status: status || 'unknown',
				progress: progress
			});

		} catch (error) {
			console.error('Error in /api/setup/sheets/progress:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ error: errorMessage }, 500);
		}
	});
}

// POST /api/setup/sheets/reset - シートセットアップリセット
export function registerApiSetupSheetsResetRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.post('/api/setup/sheets/reset', async (c) => {
		try {
			const db = drizzle(c.env.DB);

			console.log('Resetting sheet setup status');

			// セットアップ状態をリセット
			await setConfig(db, 'sheet_setup_status', 'idle');
			await setConfig(db, 'sheet_setup_progress', JSON.stringify({
				currentSheet: '',
				currentStep: 'リセット完了',
				completedSheets: [],
				totalSheets: 4,
				progress: 0,
				status: 'idle'
			}));

			return c.json({ success: true, message: 'Sheet setup reset successfully' });

		} catch (error) {
			console.error('Error in /api/setup/sheets/reset:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false, error: errorMessage }, 500);
		}
	});
}

// POST /api/setup/sheets/complete - シートセットアップ完了マーク
export function registerApiSetupSheetsCompleteRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.post('/api/setup/sheets/complete', async (c) => {
		try {
			const db = drizzle(c.env.DB);

			console.log('Manually marking sheet setup as complete');

			// スプレッドシートIDを取得
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ error: 'No spreadsheet selected' }, 400);
			}

			// 有効なトークンを取得
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ error: 'No valid token found' }, 401);
			}

			// トークンの有効性を確認し、必要に応じてリフレッシュ
			const isValid = await isTokenValid(db);
			if (!isValid) {
				const credentials = await getGoogleCredentials(db);
				if (!credentials || !tokens.refresh_token) {
					return c.json({ error: 'Authentication required' }, 401);
				}

				try {
					const newTokens = await refreshAccessToken(tokens.refresh_token, credentials);
					await saveGoogleTokens(db, newTokens);
					tokens = newTokens;
				} catch (refreshError) {
					return c.json({ error: 'Token refresh failed' }, 401);
				}
			}

			// シートの存在確認
			const setupManager = new SheetsSetupManager({
				spreadsheetId,
				accessToken: tokens.access_token
			});

			try {
				const existingSheets = await (setupManager as any)['getExistingSheets']();
				const requiredSheets = ['_User', '_Session', '_Config', '_Role'];
				const foundSheets = existingSheets.map((s: any) => s.properties?.title).filter(Boolean);

				const allSheetsExist = requiredSheets.every(sheetName => foundSheets.includes(sheetName));

				if (allSheetsExist) {
					// すべてのシートが存在する場合、完了としてマーク
					await setConfig(db, 'sheet_setup_status', 'completed');
					await setConfig(db, 'sheets_initialized', 'true');
					await setConfig(db, 'sheet_setup_progress', JSON.stringify({
						currentSheet: '',
						currentStep: '完了',
						completedSheets: requiredSheets,
						totalSheets: 4,
						progress: 100,
						status: 'completed'
					}));

					return c.json({
						success: true,
						message: 'Sheet setup marked as complete',
						foundSheets: foundSheets
					});
				} else {
					const missingSheets = requiredSheets.filter(sheet => !foundSheets.includes(sheet));
					return c.json({
						success: false,
						error: `Missing sheets: ${missingSheets.join(', ')}`,
						foundSheets: foundSheets,
						missingSheets: missingSheets
					});
				}

			} catch (verifyError) {
				console.error('Error verifying sheets:', verifyError);
				return c.json({
					success: false,
					error: `Failed to verify sheets: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`
				});
			}

		} catch (error) {
			console.error('Error in /api/setup/sheets/complete:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false, error: errorMessage }, 500);
		}
	});
}

// 非同期でシートセットアップを実行する関数
async function setupSheetsAsync(spreadsheetId: string, accessToken: string, db: any): Promise<void> {
	try {
		console.log('Starting setupSheetsAsync with spreadsheetId:', spreadsheetId);

		const setupManager = new SheetsSetupManager({
			spreadsheetId,
			accessToken
		});

		// タイムアウト処理を追加
		const setupPromise = setupManager.setupSheets(async (progress: SetupProgress) => {
			console.log('Progress callback called:', progress);

			try {
				// 進行状況をConfigテーブルに保存
				await setConfig(db, 'sheet_setup_progress', JSON.stringify(progress));

				if (progress.status === 'completed') {
					console.log('Setup completed, marking as complete in database');
					await setConfig(db, 'sheet_setup_status', 'completed');
					await setConfig(db, 'sheets_initialized', 'true');
					console.log('Database updated with completion status');
				} else if (progress.status === 'error') {
					console.log('Setup error detected, marking as error in database');
					await setConfig(db, 'sheet_setup_status', 'error');
				}
			} catch (callbackError) {
				console.error('Error in progress callback:', callbackError);
				// プログレスコールバックのエラーは無視して続行
			}
		});

		// 3分でタイムアウト
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error('Setup timeout after 3 minutes')), 180000);
		});

		const result = await Promise.race([setupPromise, timeoutPromise]) as SetupProgress;
		console.log('setupSheetsAsync completed successfully, result:', result);

		// セットアップが完了した場合、確実に完了状態をデータベースに保存
		if (result && result.status === 'completed') {
			console.log('Ensuring completion status is saved to database');
			try {
				await setConfig(db, 'sheet_setup_status', 'completed');
				await setConfig(db, 'sheets_initialized', 'true');
				await setConfig(db, 'sheet_setup_progress', JSON.stringify(result));
				console.log('Final completion status saved successfully');
			} catch (saveError) {
				console.error('Error saving final completion status:', saveError);
			}
		}

	} catch (error) {
		console.error('Error in setupSheetsAsync:', error);
		await setConfig(db, 'sheet_setup_status', 'error');

		const errorMessage = error instanceof Error ? error.message : '不明なエラー';
		const currentProgress = await getConfig(db, 'sheet_setup_progress');
		let currentState: any = {
			completedSheets: [],
			totalSheets: 4,
			progress: 0,
			currentSheet: '',
			currentStep: ''
		};

		try {
			if (currentProgress) {
				currentState = JSON.parse(currentProgress);
			}
		} catch (parseError) {
			console.error('Error parsing current progress:', parseError);
		}

		await setConfig(db, 'sheet_setup_progress', JSON.stringify({
			currentSheet: currentState.currentSheet || '',
			currentStep: 'エラーが発生しました',
			completedSheets: currentState.completedSheets || [],
			totalSheets: 4,
			progress: currentState.progress || 0,
			status: 'error',
			error: errorMessage
		}));
	}
}

// 全てのセットアップルートを登録する関数
export function registerSetupRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
	registerSetupMainRoute(app);
	registerSetupConnectRoute(app);
	registerGoogleAuthRoute(app);
	registerApiSetupRoute(app);
	registerApiResetSetupRoute(app);
	registerApiSpreadsheetsRoute(app);
	registerApiSpreadsheetsSelectRoute(app);
	registerApiSetupSheetsRoute(app);
	registerApiSetupSheetsProgressRoute(app);
	registerApiSetupSheetsResetRoute(app);
	registerApiSetupSheetsCompleteRoute(app);
}