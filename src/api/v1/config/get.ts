import { Hono } from 'hono';
import { html } from 'hono/html';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import { Env } from '@/types/env';
import {
  isAuthenticated,
  generateCSRFToken,
  setCSRFCookie,
  getCSRFToken
} from '@/utils/security';

const app = new Hono<{ Bindings: Env }>();

// Sensitive data keys
const sensitiveKeys = [
  'google.client_secret',
  'google.access_token',
  'google.refresh_token',
  'auth0.client_secret',
  'app.config_password',
  'storage.r2.secretAccessKey'
];

app.get('/', async (c) => {
  try {
    // Initialize ConfigService
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }

    // Check authentication using secure session token
    const configPassword = ConfigService.getString('app.config_password');
    const authenticated = await isAuthenticated(c, configPassword);

    if (!authenticated) {
      // Generate CSRF token for the login form
      const csrfToken = generateCSRFToken();
      setCSRFCookie(c, csrfToken);

      // Unauthenticated: password input form
      return c.html(html`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>Configuration Management - SheetDB</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 400px;
              margin: 100px auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .auth-form {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              text-align: center;
            }
            h1 {
              color: #495057;
              margin-bottom: 20px;
            }
            input {
              width: 100%;
              padding: 10px;
              margin: 10px 0;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              font-size: 16px;
            }
            button {
              width: 100%;
              padding: 12px;
              background-color: #007bff;
              color: white;
              border: none;
              border-radius: 4px;
              font-size: 16px;
              cursor: pointer;
            }
            button:hover {
              background-color: #0056b3;
            }
            .error {
              color: #dc3545;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="auth-form">
            <h1>⚙️ Configuration Management</h1>
            <p>A password is required to access the configuration screen.</p>
            <form method="post" action="/config/auth">
              <input type="hidden" name="csrf_token" value="${csrfToken}">
              <input type="password" name="password" placeholder="Configuration Password" required>
              <button type="submit">Login</button>
            </form>
            <div class="error" id="error" style="display: none;"></div>
          </div>
        </body>
        </html>
      `);
    }

    // Authenticated: display configuration list
    const configs = ConfigService.getAll();
    
    // Prepare configuration data (mask sensitive data)
    const configList = Object.entries(configs).map(([key, value]) => {
      const isSensitive = sensitiveKeys.includes(key);
      const displayValue = isSensitive ? '****' : String(value);
      const type = ConfigService.getType(key);
      
      return {
        key,
        value: displayValue,
        originalValue: value,
        type,
        isSensitive,
        description: getConfigDescription(key)
      };
    });

    return c.html(html`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Configuration Management - SheetDB</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          h1 {
            margin: 0;
            color: #495057;
          }
          .logout-btn {
            float: right;
            padding: 8px 16px;
            background-color: #6c757d;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-size: 14px;
          }
          .logout-btn:hover {
            background-color: #5a6268;
          }
          .config-table {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            background-color: #f8f9fa;
            padding: 15px;
            text-align: left;
            font-weight: bold;
            color: #495057;
            border-bottom: 1px solid #dee2e6;
          }
          td {
            padding: 15px;
            border-bottom: 1px solid #dee2e6;
          }
          tr:last-child td {
            border-bottom: none;
          }
          .key-column {
            font-family: monospace;
            font-weight: bold;
            color: #495057;
            width: 25%;
          }
          .value-column {
            width: 40%;
          }
          .value-column input {
            width: 100%;
            padding: 8px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            font-family: monospace;
          }
          .value-column input[type="password"] {
            font-family: Arial, sans-serif;
          }
          .value-column input[type="checkbox"] {
            width: auto;
            transform: scale(1.2);
          }
          .description-column {
            color: #6c757d;
            font-size: 14px;
            width: 35%;
          }
          .sensitive-note {
            color: #dc3545;
            font-size: 12px;
            margin-top: 4px;
          }
          .back-link {
            display: inline-block;
            margin-bottom: 20px;
            padding: 8px 16px;
            background-color: #28a745;
            color: white;
            text-decoration: none;
            border-radius: 4px;
          }
          .back-link:hover {
            background-color: #218838;
          }
        </style>
      </head>
      <body>
        <a href="/playground" class="back-link">← Back to Playground</a>
        
        <div class="header">
          <a href="/config/logout" class="logout-btn">Logout</a>
          <h1>⚙️ Configuration Management</h1>
          <p>You can view application configuration settings. Configuration modification is planned for the next task.</p>
        </div>

        <div class="config-table">
          <table>
            <thead>
              <tr>
                <th>Configuration Key</th>
                <th>Value</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${configList.map((config) => html`
                <tr>
                  <td class="key-column">${config.key}</td>
                  <td class="value-column">
                    ${config.type === 'boolean' ? html`
                      <input type="checkbox" ${config.originalValue ? 'checked' : ''} disabled>
                    ` : html`
                      <input 
                        type="${config.isSensitive ? 'password' : 'text'}" 
                        value="${config.value}" 
                        readonly 
                        title="Configuration modification is planned for the next task"
                      >
                    `}
                    ${config.isSensitive ? html`
                      <div class="sensitive-note">Sensitive information (masked display)</div>
                    ` : ''}
                  </td>
                  <td class="description-column">${config.description}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Config page error:', error);
    return c.html(html`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Error - Configuration Management</title>
      </head>
      <body>
        <h1>An Error Occurred</h1>
        <p>An error occurred while loading the configuration.</p>
        <a href="/playground">Back to Playground</a>
      </body>
      </html>
    `, 500);
  }
});

// Function to get configuration item descriptions
function getConfigDescription(key: string): string {
  const descriptions: Record<string, string> = {
    'google.client_id': 'Google OAuth2 Client ID',
    'google.client_secret': 'Google OAuth2 Client Secret',
    'google.sheetId': 'Main Google Spreadsheet ID',
    'auth0.domain': 'Auth0 Domain',
    'auth0.client_id': 'Auth0 Application Client ID',
    'auth0.client_secret': 'Auth0 Application Client Secret',
    'auth0.audience': 'Auth0 API Audience (optional)',
    'auth0.scope': 'OAuth2 Scope',
    'app.config_password': 'Configuration screen access password',
    'app.setup_completed': 'Initial setup completion flag',
    'storage.type': 'File storage type (r2 | google_drive)'
  };
  
  return descriptions[key] || 'Configuration item';
}

export default app;