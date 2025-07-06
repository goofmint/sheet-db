import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import { drizzle } from 'drizzle-orm/d1';
import { configTable } from './db/schema';
import { setupHtml } from './setup-html';
import { spreadsheetSelectionHtml } from './spreadsheet-selection-html';
import { SheetsSetupManager, SetupProgress } from './sheet-schema';
import {
  saveGoogleCredentials,
  getGoogleCredentials,
  saveGoogleTokens,
  exchangeCodeForTokens,
  setConfig,
  getConfig,
  getGoogleTokens,
  refreshAccessToken,
  isTokenValid,
  isSetupCompleted,
  resetSetupCompleted,
} from './google-auth';

type Bindings = {
	DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Static file serving
app.use('/static/*', serveStatic({ 
  root: './public',
  manifest: {}
}));

app.get('/', async (c) => {
	try {
		const db = drizzle(c.env.DB);
		const configs = await db.select().from(configTable);
		
		if (configs.length === 0) {
			return c.redirect('/setup');
		}
		
		return c.text('Sheet DB API');
	} catch (error) {
		// テーブルが存在しない場合は初期化が必要
		return c.redirect('/setup');
	}
});

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
						
						if (confirm('セットアップをリセットしますか？\\n\\n現在の設定がすべて削除され、最初からセットアップが必要になります。')) {
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

app.post('/connects', async (c) => {
	try {
		const db = drizzle(c.env.DB);
		
		// セットアップ完了チェック
		const setupCompleted = await isSetupCompleted(db);
		if (setupCompleted) {
			return c.json({ 
				error: 'Setup is already completed. Please reset setup_completed flag to reconfigure.' 
			}, 403);
		}
		
		const body = await c.req.json();
		const { clientId, clientSecret } = body;
		
		let actualClientId, actualClientSecret;
		
		// 既存の認証情報を確認
		const existingCredentials = await getGoogleCredentials(db);
		
		if (clientSecret === undefined && existingCredentials) {
			// 既存の認証情報を使用
			actualClientId = existingCredentials.client_id;
			actualClientSecret = existingCredentials.client_secret;
		} else {
			// 新しい認証情報を使用
			if (!clientId || !clientSecret) {
				return c.json({ error: 'Client ID and Client Secret are required' }, 400);
			}
			
			actualClientId = clientId;
			actualClientSecret = clientSecret;
			
			// Google認証情報をConfigテーブルに保存
			await saveGoogleCredentials(db, {
				client_id: clientId,
				client_secret: clientSecret,
			});
		}
		
		// Google OAuth2認証URLを生成
		const scopes = [
			'https://www.googleapis.com/auth/spreadsheets',
			'https://www.googleapis.com/auth/drive.readonly'
		].join(' ');
		
		const redirectUri = `${new URL(c.req.url).origin}/auth/callback`;
		const state = crypto.randomUUID(); // CSRF防止用のstate
		
		// stateをConfigテーブルに一時保存（CSRF対策）
		await setConfig(db, `oauth_state_${state}`, 'pending');
		
		const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
			`client_id=${encodeURIComponent(actualClientId)}&` +
			`redirect_uri=${encodeURIComponent(redirectUri)}&` +
			`scope=${encodeURIComponent(scopes)}&` +
			`response_type=code&` +
			`access_type=offline&` +
			`prompt=consent&` +
			`state=${encodeURIComponent(state)}`;
		
		return c.json({ 
			authUrl: authUrl,
			state: state 
		});
		
	} catch (error) {
		console.error('Error in /connects:', error);
		return c.json({ error: 'Invalid request' }, 400);
	}
});

app.get('/auth/callback', async (c) => {
	const code = c.req.query('code');
	const state = c.req.query('state');
	const error = c.req.query('error');
	
	if (error) {
		return c.html(`
			<h1>認証エラー</h1>
			<p>Google認証中にエラーが発生しました: ${error}</p>
			<a href="/setup">セットアップに戻る</a>
		`);
	}
	
	if (!code || !state) {
		return c.html(`
			<h1>認証エラー</h1>
			<p>認証コードまたはstateパラメータが取得できませんでした。</p>
			<a href="/setup">セットアップに戻る</a>
		`);
	}
	
	try {
		const db = drizzle(c.env.DB);
		
		// stateの検証（CSRF対策）
		const savedState = await getConfig(db, `oauth_state_${state}`);
		if (savedState !== 'pending') {
			return c.html(`
				<h1>認証エラー</h1>
				<p>無効なstateパラメータです。</p>
				<a href="/setup">セットアップに戻る</a>
			`);
		}
		
		// 使用済みstateを削除
		await setConfig(db, `oauth_state_${state}`, 'used');
		
		// 保存されたGoogle認証情報を取得
		const credentials = await getGoogleCredentials(db);
		if (!credentials) {
			return c.html(`
				<h1>認証エラー</h1>
				<p>Google認証情報が見つかりません。セットアップを最初からやり直してください。</p>
				<a href="/setup">セットアップに戻る</a>
			`);
		}
		
		// 認証コードをアクセストークンに交換
		const redirectUri = `${new URL(c.req.url).origin}/auth/callback`;
		const tokens = await exchangeCodeForTokens(code, redirectUri, credentials);
		
		// トークンをConfigテーブルに保存
		await saveGoogleTokens(db, tokens);
		
		// 認証完了フラグを設定
		await setConfig(db, 'google_auth_completed', 'true');
		
		return c.html(`
			<h1>認証成功</h1>
			<p>Googleアカウントとの接続が完了しました。スプレッドシートを選択してください。</p>
			<script>
				// 親ウィンドウにメッセージを送信（ポップアップの場合）
				if (window.opener) {
					window.opener.postMessage({ type: 'google_auth_success', success: true }, '*');
					window.close();
				} else {
					// 通常のリダイレクトの場合
					window.location.href = '/setup/connect';
				}
			</script>
		`);
		
	} catch (error) {
		console.error('Error in /auth/callback:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return c.html(`
			<h1>認証エラー</h1>
			<p>トークンの取得中にエラーが発生しました: ${errorMessage}</p>
			<a href="/setup">セットアップに戻る</a>
		`);
	}
});

// トークンリフレッシュエンドポイント
app.post('/auth/refresh', async (c) => {
	try {
		const db = drizzle(c.env.DB);
		
		// 現在のトークンを確認
		const currentTokens = await getGoogleTokens(db);
		if (!currentTokens || !currentTokens.refresh_token) {
			return c.json({ error: 'No refresh token available' }, 400);
		}
		
		// Google認証情報を取得
		const credentials = await getGoogleCredentials(db);
		if (!credentials) {
			return c.json({ error: 'No Google credentials found' }, 400);
		}
		
		// トークンをリフレッシュ
		const newTokens = await refreshAccessToken(currentTokens.refresh_token, credentials);
		
		// 新しいトークンを保存
		await saveGoogleTokens(db, newTokens);
		
		return c.json({ 
			success: true, 
			expires_in: newTokens.expires_in 
		});
		
	} catch (error) {
		console.error('Error in /auth/refresh:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return c.json({ error: `Token refresh failed: ${errorMessage}` }, 500);
	}
});

// 有効なアクセストークンを取得するエンドポイント（内部API用）
app.get('/api/token', async (c) => {
	try {
		const db = drizzle(c.env.DB);
		
		// トークンの有効性を確認
		const isValid = await isTokenValid(db);
		
		if (!isValid) {
			// トークンが無効な場合、リフレッシュを試行
			const currentTokens = await getGoogleTokens(db);
			const credentials = await getGoogleCredentials(db);
			
			if (!currentTokens?.refresh_token || !credentials) {
				return c.json({ error: 'Authentication required' }, 401);
			}
			
			try {
				const newTokens = await refreshAccessToken(currentTokens.refresh_token, credentials);
				await saveGoogleTokens(db, newTokens);
			} catch (refreshError) {
				return c.json({ error: 'Token refresh failed. Re-authentication required.' }, 401);
			}
		}
		
		// 有効なトークンを取得
		const tokens = await getGoogleTokens(db);
		if (!tokens) {
			return c.json({ error: 'No valid token found' }, 401);
		}
		
		return c.json({
			access_token: tokens.access_token,
			expires_in: tokens.expires_in,
			scope: tokens.scope,
		});
		
	} catch (error) {
		console.error('Error in /api/token:', error);
		return c.json({ error: 'Internal server error' }, 500);
	}
});

// セットアップ情報保存エンドポイント
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

// セットアップリセットエンドポイント
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

// スプレッドシート一覧取得エンドポイント
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

// スプレッドシート選択エンドポイント
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

// シートセットアップ開始エンドポイント
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

// シートセットアップ進行状況確認エンドポイント
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

// シートセットアップリセットエンドポイント
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

// シートセットアップを完了として手動でマークするエンドポイント
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
			const existingSheets = await setupManager['getExistingSheets']();
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

app.get('/health', (c) => {
	return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth0認証開始エンドポイント
app.get('/api/auth', async (c) => {
	try {
		const db = drizzle(c.env.DB);
		
		// クエリパラメータを確認（コールバックからのリダイレクトの場合）
		const code = c.req.query('code');
		const error = c.req.query('error');
		
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
		
		// Auth0認証URLを構築
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: auth0ClientId,
			redirect_uri: redirectUri,
			scope: 'openid profile email',
			state: crypto.randomUUID() // CSRF保護用
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

// Auth0認証コールバックエンドポイント（Auth0からのコールバック受信）
app.get('/api/auth/callback', async (c) => {
	try {
		// クエリパラメータを取得
		const code = c.req.query('code');
		const error = c.req.query('error');
		const state = c.req.query('state');
		
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

// POST /api/auth/callback エンドポイント（実際の認証処理）
app.post('/api/auth/callback', async (c) => {
	try {
		const db = drizzle(c.env.DB);
		
		// リクエストボディから認証コードを取得
		const body = await c.req.json();
		const { code } = body;
		
		if (!code) {
			return c.json({
				success: false,
				error: 'Authorization code is required'
			}, 400);
		}
		
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

// 認証コールバック処理関数
async function handleAuthCallback(c: any, db: any, code: string): Promise<any> {
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
			console.error('Token exchange failed:', tokenResponse.status, errorText);
			return c.json({
				success: false,
				error: 'Failed to exchange authorization code for tokens'
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
			sessionId: sessionId,
			user: savedUser
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
async function saveUserToSheet(db: any, userInfo: any): Promise<any> {
	try {
		console.log('Saving user to _User sheet:', userInfo.sub);
		
		// Google Sheetsの設定を取得
		const spreadsheetId = await getConfig(db, 'spreadsheet_id');
		if (!spreadsheetId) {
			throw new Error('No spreadsheet selected');
		}
		
		// 有効なGoogleトークンを取得
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
		const userData = [
			userInfo.sub || '',                    // id
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
			'[]',                                  // user_read
			'[]'                                   // user_write
		];
		
		// 既存ユーザーをチェック
		const existingUserResponse = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_User!A:A`,
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
				userData[9] = values[userRowIndex][9] || now; // created_atは保持（インデックス9に変更）
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
			id: userInfo.sub || '',
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
			public_read: false,
			public_write: false,
			role_read: [],
			role_write: [],
			user_read: [],
			user_write: []
		};
		
	} catch (error) {
		console.error('Error saving user to sheet:', error);
		throw error;
	}
}

// セッション情報を_Sessionシートに保存する関数
async function saveSessionToSheet(db: any, sessionId: string, userId: string, accessToken: string): Promise<void> {
	try {
		console.log('Saving session to _Session sheet:', sessionId);
		
		// Google Sheetsの設定を取得
		const spreadsheetId = await getConfig(db, 'spreadsheet_id');
		if (!spreadsheetId) {
			throw new Error('No spreadsheet selected');
		}
		
		// 有効なGoogleトークンを取得
		let tokens = await getGoogleTokens(db);
		if (!tokens) {
			throw new Error('No valid Google token found');
		}
		
		// 現在の日時と有効期限（1時間後）
		const now = new Date();
		const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1時間後
		
		// セッションデータを準備
		const sessionData = [
			sessionId,                             // id
			userId,                                // user_id
			accessToken.substring(0, 20) + '...', // token（セキュリティのため一部のみ）
			expiresAt.toISOString(),              // expires_at
			now.toISOString(),                    // created_at
			now.toISOString()                     // updated_at
		];
		
		// 最後の行に追加
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

export default app;
