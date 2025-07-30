import { Hono } from 'hono';
import { html } from 'hono/html';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import { getConfigDescription } from '@/repositories/config';
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
          <link rel="stylesheet" href="/assets/styles/config.css">
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
    
    // Use existing CSRF token if available, otherwise generate new one
    let csrfToken = getCSRFToken(c);
    if (!csrfToken) {
      csrfToken = generateCSRFToken();
      setCSRFCookie(c, csrfToken);
    }
    
    // Prepare configuration data (sensitive data shown as password fields)
    const configList = Object.entries(configs).map(([key, value]) => {
      const isSensitive = sensitiveKeys.includes(key);
      const type = ConfigService.getType(key);
      
      // Clean the value to remove any extra quotes or JSON encoding issues
      let cleanValue = String(value);
      
      // Handle potential JSON double-encoding - only for non-boolean values
      if (type !== 'boolean') {
        try {
          // If the value looks like a JSON-encoded string, try to parse it
          if (cleanValue.startsWith('"') && cleanValue.endsWith('"') && cleanValue.length > 2) {
            const parsed = JSON.parse(cleanValue);
            if (typeof parsed === 'string') {
              cleanValue = parsed;
            }
          }
        } catch (e) {
          // If JSON parsing fails, manually remove outer quotes only
          if (cleanValue.startsWith('"') && cleanValue.endsWith('"') && cleanValue.length > 2) {
            cleanValue = cleanValue.slice(1, -1);
          }
        }
      }
      
      // Ensure it's still a string
      cleanValue = String(cleanValue);
      
      return {
        key,
        value: cleanValue,
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
        <link rel="stylesheet" href="/assets/styles/config.css">
      </head>
      <body>
        <a href="/playground" class="back-link">← Back to Playground</a>
        
        <div class="header">
          <a href="/config/logout" class="logout-btn">Logout</a>
          <h1>⚙️ Configuration Management</h1>
          <p>Manage your application configuration settings</p>
        </div>

        <form id="configForm" method="post" action="/config/update">
          <input type="hidden" name="csrf_token" value="${csrfToken}">
          
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
                        <label class="checkbox-container">
                          <input 
                            type="checkbox" 
                            name="${config.key}" 
                            ${config.value === 'true' ? 'checked' : ''}
                            data-original="${config.value}"
                          >
                          <span class="checkbox-label">${config.value === 'true' ? 'Enabled' : 'Disabled'}</span>
                        </label>
                      ` : html`
                        <div class="value-input-container">
                          <input 
                            type="${config.isSensitive ? 'password' : 'text'}" 
                            name="${config.key}"
                            value="${config.isSensitive ? '' : config.value}" 
                            ${config.isSensitive ? '' : `data-original="${config.value}"`}
                            data-field-type="${config.isSensitive ? 'sensitive' : 'normal'}"
                            ${config.isSensitive ? 'placeholder="Leave empty to keep current"' : ''}
                          >
                          ${config.isSensitive ? '' : html`<button type="button" class="reset-btn" title="Reset to original value" data-key="${config.key}">↺</button>`}
                        </div>
                      `}
                      <div class="validation-status" id="validation-${config.key}"></div>
                      ${config.isSensitive ? html`
                        <div class="sensitive-note">Sensitive information</div>
                      ` : ''}
                    </td>
                    <td class="description-column">${config.description}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save All</button>
            <button type="button" class="btn btn-secondary" id="resetAll">Reset All</button>
            <span class="changes-indicator" id="changesCount">0 changes</span>
          </div>
        </form>

        <!-- Confirmation Modal -->
        <div id="confirmationModal" class="modal">
          <div class="modal-content">
            <h3>⚠️ Confirm Sensitive Changes</h3>
            <p>You are about to modify sensitive configuration values:</p>
            <div id="sensitiveChangesList" class="sensitive-changes"></div>
            <p><strong>This action cannot be undone.</strong> Are you sure you want to proceed?</p>
            <div class="modal-buttons">
              <button type="button" class="btn-danger" id="confirmSubmit">Yes, Save Changes</button>
              <button type="button" class="btn-secondary" id="cancelSubmit">Cancel</button>
            </div>
          </div>
        </div>

        <script src="/assets/scripts/config.js"></script>
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

export default app;