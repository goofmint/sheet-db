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
	resetSetupCompleted,
	type DatabaseConnection
} from '../google-auth';
import { SheetsSetupManager, SetupProgress } from '../sheet-schema';
import { loadTemplateWithConfig, loadTemplate, loadTemplateWithVariables, TemplateBindings } from '../utils/template-loader';

type Bindings = {
	DB: D1Database;
	ASSETS: Fetcher;
};


// GET /setup-page - Main setup page
export function registerSetupMainRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.get('/setup-page', async (c) => {
		try {
			const db = drizzle(c.env.DB);

			// Check setup completion
			const setupCompleted = await isSetupCompleted(db);
			
			if (setupCompleted) {
				// If accessing /setup-page?reset=true, show the reset page
				if (c.req.query('reset') === 'true') {
					const html = await loadTemplate(c.env.ASSETS, 'setup-completed.html');
					return c.html(html);
				}
				// Otherwise redirect to playground
				return c.redirect('/playground');
			}

			// Check existing settings
			const credentials = await getGoogleCredentials(db);
			const connected = c.req.query('connected') === 'true';
			const spreadsheetSelected = c.req.query('spreadsheet') === 'selected';

			// Get all config values in one query
			const configs = await getConfig(db, [
				'google_auth_completed',
				'auth0_domain',
				'auth0_client_id', 
				'auth0_client_secret',
				'auth0_audience',
				'reset_token',
				'spreadsheet_id',
				'spreadsheet_name',
				'spreadsheet_url',
				'sheets_initialized',
				'sheet_setup_status',
				'sheet_setup_progress'
			]);

			// Embed configuration status into HTML
			const configData = {
				hasCredentials: !!credentials,
				clientId: credentials?.client_id || '',
				authCompleted: configs.google_auth_completed === 'true',
				connected: connected,
				spreadsheetSelected: spreadsheetSelected,
				// Auth0 settings
				auth0Domain: configs.auth0_domain || '',
				auth0ClientId: configs.auth0_client_id || '',
				auth0ClientSecret: configs.auth0_client_secret || '',
				auth0Audience: configs.auth0_audience || '',
				resetToken: configs.reset_token || '',
				hasAuth0Config: !!(configs.auth0_domain && configs.auth0_client_id && configs.auth0_client_secret),
				// Spreadsheet settings
				spreadsheetId: configs.spreadsheet_id || '',
				spreadsheetName: configs.spreadsheet_name || '',
				spreadsheetUrl: configs.spreadsheet_url || '',
				hasSpreadsheet: !!configs.spreadsheet_id,
				sheetsInitialized: configs.sheets_initialized === 'true',
				sheetSetupStatus: configs.sheet_setup_status || '',
				sheetSetupProgress: configs.sheet_setup_progress || ''
			};

			// Load template with configuration data injected
			const html = await loadTemplateWithConfig(c.env.ASSETS, 'setup-form.html', configData);
			return c.html(html);
		} catch (error) {
			console.error('Error in /setup-page:', error);
			// Fallback to basic template without config if there's an error
			try {
				const fallbackHtml = await loadTemplateWithConfig(c.env.ASSETS, 'setup-form.html', {});
				return c.html(fallbackHtml);
			} catch (fallbackError) {
				console.error('Error loading fallback template:', fallbackError);
				return c.html('<h1>Setup page temporarily unavailable</h1>');
			}
		}
	});
}

// GET /setup/connect - Spreadsheet selection page
export function registerSetupConnectRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.get('/setup/connect', async (c) => {
		try {
			const db = drizzle(c.env.DB);

			// Check setup completion
			const setupCompleted = await isSetupCompleted(db);
			if (setupCompleted) {
				return c.json({
					error: 'Setup is already completed. Please reset setup_completed flag to reconfigure.'
				}, 403);
			}

			// Handle OAuth callback (when code parameter exists)
			const code = c.req.query('code');
			const error = c.req.query('error');

			if (error) {
				console.error('OAuth error:', error);
				const html = await loadTemplateWithVariables(c.env.ASSETS, 'auth-error.html', { error });
				return c.html(html);
			}

			if (code) {
				console.log('Processing OAuth callback with code:', code.substring(0, 10) + '...');

				try {
					// Get client information
					const credentials = await getGoogleCredentials(db);
					if (!credentials) {
						throw new Error('Google credentials not found');
					}

					// Exchange authorization code for access token
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

					// Save tokens
					await saveGoogleTokens(db, tokens);
					await setConfig(db, 'google_auth_completed', 'true');

					// Redirect to spreadsheet selection page
					return c.redirect('/setup-page?connected=true');

				} catch (exchangeError) {
					console.error('Error exchanging code for tokens:', exchangeError);
					const errorMessage = exchangeError instanceof Error ? exchangeError.message : 'Unknown error';
					const html = await loadTemplateWithVariables(c.env.ASSETS, 'auth-processing-error.html', { error: errorMessage });
					return c.html(html);
				}
			}

			// Check if Google authentication is completed
			const authCompleted = await getConfig(db, 'google_auth_completed');
			if (authCompleted !== 'true') {
				const html = await loadTemplate(c.env.ASSETS, 'auth-required.html');
				return c.html(html);
			}

			// Check valid token and refresh if necessary
			const isValid = await isTokenValid(db);
			if (!isValid) {
				// If token is invalid, attempt refresh
				const currentTokens = await getGoogleTokens(db);
				const credentials = await getGoogleCredentials(db);

				if (!currentTokens?.refresh_token || !credentials) {
					const html = await loadTemplateWithVariables(c.env.ASSETS, 'auth-invalid.html', { 
						message: 'Token is invalid and no refresh token available. Please perform Google authentication again.' 
					});
					return c.html(html);
				}

				try {
					const newTokens = await refreshAccessToken(currentTokens.refresh_token, credentials);
					await saveGoogleTokens(db, newTokens);
					console.log('Token refreshed successfully for /setup/connect');
				} catch (refreshError) {
					console.error('Failed to refresh token in /setup/connect:', refreshError);
					const errorMessage = refreshError instanceof Error ? refreshError.message : 'Unknown error';
					const html = await loadTemplateWithVariables(c.env.ASSETS, 'auth-invalid.html', { 
						message: 'Token refresh failed. Please perform Google authentication again.',
						error: errorMessage
					});
					return c.html(html);
				}
			}

			// Display spreadsheet selection page
			const html = await loadTemplate(c.env.ASSETS, 'spreadsheet-selection.html');
			return c.html(html);

		} catch (error) {
			console.error('Error in /setup/connect:', error);
			const html = await loadTemplateWithVariables(c.env.ASSETS, 'generic-error.html', { 
				message: 'An error occurred while loading the spreadsheet selection page.' 
			});
			return c.html(html);
		}
	});
}

// POST /api/setup/auth - Generate Google OAuth URL
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

			// Temporarily save client information
			await setConfig(db, 'google_client_id', clientId);
			if (clientSecret && clientSecret !== '[SAVED]') {
				await setConfig(db, 'google_client_secret', clientSecret);
			}

			// Generate OAuth URL
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

// POST /api/setup - Save setup information
export function registerApiSetupRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.post('/api/setup', async (c) => {
		try {
			const body = await c.req.json();
			const db = drizzle(c.env.DB);

			// Debug: Log received data (reset token partially masked)
			console.log('Received setup data keys:', Object.keys(body));
			console.log('Reset token provided:', body.resetToken !== undefined);
			console.log('Reset token length:', body.resetToken ? body.resetToken.length : 'undefined');
			console.log('Reset token type:', typeof body.resetToken);

			// Check if value is masked
			const isMaskedToken = body.resetToken && /^•+$/.test(body.resetToken);
			console.log('Reset token is masked:', isMaskedToken);

			if (body.resetToken && !isMaskedToken) {
				console.log('Reset token preview:', body.resetToken.substring(0, 4) + '...' + body.resetToken.substring(-4));
			}

			// Reset token validation
			// Validate only when new reset token is provided
			if (body.resetToken !== undefined) {
				// Error if masked value
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
				// Save reset token
				console.log('Saving new reset token');
				await setConfig(db, 'reset_token', body.resetToken);
			} else {
				// If no reset token provided, check existing token
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

			// Save Auth0 settings
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

			// Save spreadsheet information (if exists)
			if (body.spreadsheetId) {
				await setConfig(db, 'spreadsheet_id', body.spreadsheetId);
			}
			if (body.spreadsheetName) {
				await setConfig(db, 'spreadsheet_name', body.spreadsheetName);
			}
			if (body.spreadsheetUrl) {
				await setConfig(db, 'spreadsheet_url', body.spreadsheetUrl);
			}

			// Set setup completion flag
			await setConfig(db, 'setup_completed', 'true');

			return c.json({ success: true });

		} catch (error) {
			console.error('Error in /api/setup:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false, error: errorMessage }, 500);
		}
	});
}

// POST /api/reset-setup - Reset setup
export function registerApiResetSetupRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.post('/api/reset-setup', async (c) => {
		try {
			const body = await c.req.json();
			const db = drizzle(c.env.DB);

			// Check reset token
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

			// Reset setup completion flag
			await resetSetupCompleted(db);

			return c.json({ success: true, message: 'Setup has been reset successfully' });

		} catch (error) {
			console.error('Error in /api/reset-setup:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false, error: errorMessage }, 500);
		}
	});
}

// GET /api/spreadsheets - Get spreadsheet list
export function registerApiSpreadsheetsRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.get('/api/spreadsheets', async (c) => {
		try {
			const db = drizzle(c.env.DB);

			// Get valid token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ error: 'No valid token found. Please re-authenticate.' }, 401);
			}

			// Check token validity and refresh if necessary
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
					tokens = newTokens; // Update with new tokens
					console.log('Token refreshed successfully for API request');
				} catch (refreshError) {
					console.error('Token refresh failed:', refreshError);
					return c.json({
						error: `Token refresh failed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}. Re-authentication required.`
					}, 401);
				}
			}

			// Get spreadsheets via Google Drive API
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

				// Special handling for authentication errors
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

// POST /api/spreadsheets/select - Select spreadsheet
export function registerApiSpreadsheetsSelectRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.post('/api/spreadsheets/select', async (c) => {
		try {
			const body = await c.req.json();
			const db = drizzle(c.env.DB);

			const { spreadsheetId, spreadsheetName, spreadsheetUrl, force } = body;

			if (!spreadsheetId || !spreadsheetName) {
				return c.json({
					success: false,
					error: 'Spreadsheet ID and name are required'
				}, 400);
			}

			// Check currently selected spreadsheet ID
			const currentSpreadsheetId = await getConfig(db, 'spreadsheet_id');
			const isNewSpreadsheet = currentSpreadsheetId !== spreadsheetId;

			console.log('Selecting spreadsheet:', {
				spreadsheetId,
				spreadsheetName,
				isNewSpreadsheet,
				currentSpreadsheetId,
				force: !!force
			});

			// Check if we need to reset sheet setup (new spreadsheet or forced reset)
			const shouldResetSheetSetup = isNewSpreadsheet || force;

			if (shouldResetSheetSetup) {
				console.log('Previous sheet setup status before reset:', {
					currentSheetSetupStatus: await getConfig(db, 'sheet_setup_status'),
					currentSheetsInitialized: await getConfig(db, 'sheets_initialized')
				});
			}

			// If new spreadsheet selected OR force is true, reset sheet-related state
			if (shouldResetSheetSetup) {
				const resetReason = isNewSpreadsheet ? 'New spreadsheet selected' : 'Force re-initialization requested';
				console.log(`${resetReason}, resetting sheet setup status`);

				// Reset sheet initialization-related state
				await setConfig(db, 'sheet_setup_status', '');
				await setConfig(db, 'sheets_initialized', '');
				await setConfig(db, 'sheet_setup_progress', '');

				console.log(`Sheet setup status reset: ${resetReason}`);
			}

			// Save spreadsheet information to Config table
			await setConfig(db, 'spreadsheet_id', spreadsheetId);
			await setConfig(db, 'spreadsheet_name', spreadsheetName);
			if (spreadsheetUrl) {
				await setConfig(db, 'spreadsheet_url', spreadsheetUrl);
			}

			return c.json({
				success: true,
				resetSheetStatus: shouldResetSheetSetup
			});

		} catch (error) {
			console.error('Error in /api/spreadsheets/select:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({ success: false, error: errorMessage }, 500);
		}
	});
}

// POST /api/setup/sheets - Start sheet setup
export function registerApiSetupSheetsRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.post('/api/setup/sheets', async (c) => {
		try {
			const db = drizzle(c.env.DB);

			// Get required information
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ error: 'No spreadsheet selected' }, 400);
			}

			// Get valid token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ error: 'No valid token found. Please re-authenticate.' }, 401);
			}

			// Check token validity and refresh if necessary
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

			// ID for saving setup progress to Config table
			const setupId = crypto.randomUUID();
			await setConfig(db, 'sheet_setup_id', setupId);
			await setConfig(db, 'sheet_setup_status', 'running');
			await setConfig(db, 'sheet_setup_progress', JSON.stringify({
				currentSheet: '',
				currentStep: 'Initializing...',
				completedSheets: [],
				totalSheets: 4,
				progress: 0,
				status: 'running'
			}));

			// Execute sheet setup asynchronously
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

// GET /api/setup/sheets/progress - Check sheet setup progress
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

// POST /api/setup/sheets/reset - Reset sheet setup
export function registerApiSetupSheetsResetRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.post('/api/setup/sheets/reset', async (c) => {
		try {
			const db = drizzle(c.env.DB);

			console.log('Resetting sheet setup status');

			// Reset setup state completely
			await setConfig(db, 'sheet_setup_status', '');
			await setConfig(db, 'sheets_initialized', '');
			await setConfig(db, 'sheet_setup_progress', JSON.stringify({
				currentSheet: '',
				currentStep: 'Reset Complete',
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

// POST /api/setup/sheets/complete - Mark sheet setup as complete
export function registerApiSetupSheetsCompleteRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.post('/api/setup/sheets/complete', async (c) => {
		try {
			const db = drizzle(c.env.DB);

			console.log('Manually marking sheet setup as complete');

			// Get spreadsheet ID
			const spreadsheetId = await getConfig(db, 'spreadsheet_id');
			if (!spreadsheetId) {
				return c.json({ error: 'No spreadsheet selected' }, 400);
			}

			// Get valid token
			let tokens = await getGoogleTokens(db);
			if (!tokens) {
				return c.json({ error: 'No valid token found' }, 401);
			}

			// Check token validity and refresh if necessary
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

			// Check sheet existence
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
					// If all sheets exist, mark as complete
					await setConfig(db, 'sheet_setup_status', 'completed');
					await setConfig(db, 'sheets_initialized', 'true');
					await setConfig(db, 'sheet_setup_progress', JSON.stringify({
						currentSheet: '',
						currentStep: 'Complete',
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

// Function to execute sheet setup asynchronously
async function setupSheetsAsync(spreadsheetId: string, accessToken: string, db: DatabaseConnection): Promise<void> {
	try {
		console.log('Starting setupSheetsAsync with spreadsheetId:', spreadsheetId);

		const setupManager = new SheetsSetupManager({
			spreadsheetId,
			accessToken
		});

		// Add timeout handling
		const setupPromise = setupManager.setupSheets(async (progress: SetupProgress) => {
			console.log('Progress callback called:', progress);

			try {
				// Save progress to Config table
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
				// Ignore progress callback errors and continue
			}
		});

		// 3 minute timeout
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error('Setup timeout after 3 minutes')), 180000);
		});

		const result = await Promise.race([setupPromise, timeoutPromise]) as SetupProgress;
		console.log('setupSheetsAsync completed successfully, result:', result);

		// If setup completed, ensure completion state is saved to database
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

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
			currentStep: 'An error occurred',
			completedSheets: currentState.completedSheets || [],
			totalSheets: 4,
			progress: currentState.progress || 0,
			status: 'error',
			error: errorMessage
		}));
	}
}

// Function to register all setup routes
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