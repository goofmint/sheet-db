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
      
      return {
        key,
        value: String(value),
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
          .actions-column {
            width: 15%;
          }
          .reset-btn, .validate-btn {
            padding: 4px 8px;
            margin-left: 8px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            background-color: #f8f9fa;
            cursor: pointer;
            font-size: 12px;
          }
          .reset-btn:hover, .validate-btn:hover {
            background-color: #e9ecef;
          }
          .validation-status {
            font-size: 12px;
            margin-top: 4px;
          }
          .validation-status.success {
            color: #28a745;
          }
          .validation-status.error {
            color: #dc3545;
          }
          .form-actions {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-top: 20px;
            text-align: center;
          }
          .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin: 0 10px;
          }
          .btn-primary {
            background-color: #007bff;
            color: white;
          }
          .btn-primary:hover {
            background-color: #0056b3;
          }
          .btn-secondary {
            background-color: #6c757d;
            color: white;
          }
          .btn-secondary:hover {
            background-color: #5a6268;
          }
          .changes-indicator {
            margin-left: 20px;
            font-size: 14px;
            color: #6c757d;
          }
          .changed {
            background-color: #fff3cd;
          }
        </style>
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${configList.map((config) => html`
                  <tr>
                    <td class="key-column">${config.key}</td>
                    <td class="value-column">
                      ${config.type === 'boolean' ? html`
                        <input 
                          type="checkbox" 
                          name="${config.key}" 
                          ${config.value === 'true' ? 'checked' : ''}
                          data-original="${config.value}"
                        >
                      ` : html`
                        <input 
                          type="${config.isSensitive ? 'password' : 'text'}" 
                          name="${config.key}"
                          value="${config.value}" 
                          data-original="${config.value}"
                          data-field-type="${config.isSensitive ? 'sensitive' : 'normal'}"
                        >
                        <button type="button" class="reset-btn" title="Reset to original value" data-key="${config.key}">↺</button>
                      `}
                      <div class="validation-status" id="validation-${config.key}"></div>
                      ${config.isSensitive ? html`
                        <div class="sensitive-note">Sensitive information</div>
                      ` : ''}
                    </td>
                    <td class="description-column">${config.description}</td>
                    <td class="actions-column">
                      <button type="button" class="validate-btn" data-key="${config.key}">Validate</button>
                    </td>
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

        <script>
          // Track changes and update UI
          function updateChangesCount() {
            const changedInputs = document.querySelectorAll('input[data-original]');
            let changesCount = 0;
            
            changedInputs.forEach(input => {
              const original = input.dataset.original;
              const current = input.type === 'checkbox' ? input.checked.toString() : input.value;
              
              if (current !== original) {
                changesCount++;
                input.closest('tr').classList.add('changed');
              } else {
                input.closest('tr').classList.remove('changed');
              }
            });
            
            document.getElementById('changesCount').textContent = changesCount + ' changes';
          }

          // Reset individual field
          function resetField(key) {
            const input = document.querySelector(\`input[name="\${key}"]\`);
            if (input) {
              const original = input.dataset.original;
              if (input.type === 'checkbox') {
                input.checked = original === 'true';
              } else {
                input.value = original;
              }
              updateChangesCount();
            }
          }

          // Reset all fields
          function resetAllFields() {
            const inputs = document.querySelectorAll('input[data-original]');
            inputs.forEach(input => {
              const original = input.dataset.original;
              if (input.type === 'checkbox') {
                input.checked = original === 'true';
              } else {
                input.value = original;
              }
            });
            updateChangesCount();
          }

          // Basic client-side validation
          function validateField(key) {
            const input = document.querySelector(\`input[name="\${key}"]\`);
            const statusElement = document.getElementById(\`validation-\${key}\`);
            
            if (!input || !statusElement) return;
            
            const value = input.type === 'checkbox' ? input.checked.toString() : input.value;
            
            // Basic validation rules
            let isValid = true;
            let message = '';
            
            if (key.includes('client_id') && value && !value.includes('.')) {
              isValid = false;
              message = 'Invalid client ID format';
            } else if (key.includes('domain') && value && !value.includes('.')) {
              isValid = false;
              message = 'Invalid domain format';
            } else if (key.includes('password') && value && value.length < 8) {
              isValid = false;
              message = 'Password must be at least 8 characters';
            }
            
            statusElement.className = \`validation-status \${isValid ? 'success' : 'error'}\`;
            statusElement.textContent = isValid ? '✓ Valid' : \`✗ \${message}\`;
          }

          // Event listeners
          document.addEventListener('DOMContentLoaded', function() {
            // Track changes on all inputs
            const inputs = document.querySelectorAll('input[data-original]');
            inputs.forEach(input => {
              input.addEventListener('input', updateChangesCount);
              input.addEventListener('change', updateChangesCount);
            });

            // Reset button handlers
            document.querySelectorAll('.reset-btn').forEach(btn => {
              btn.addEventListener('click', function() {
                const key = this.dataset.key;
                resetField(key);
              });
            });

            // Validate button handlers
            document.querySelectorAll('.validate-btn').forEach(btn => {
              btn.addEventListener('click', function() {
                const key = this.dataset.key;
                validateField(key);
              });
            });

            // Reset all button
            document.getElementById('resetAll').addEventListener('click', function() {
              if (confirm('Are you sure you want to reset all changes?')) {
                resetAllFields();
              }
            });

            // Form submission
            document.getElementById('configForm').addEventListener('submit', function(e) {
              // Check if there are any validation errors
              const errorElements = document.querySelectorAll('.validation-status.error');
              if (errorElements.length > 0) {
                e.preventDefault();
                alert('Please fix validation errors before saving.');
                return;
              }
              
              // Show loading state
              const submitBtn = document.querySelector('button[type="submit"]');
              submitBtn.disabled = true;
              submitBtn.textContent = 'Saving...';
            });

            // Initial change count
            updateChangesCount();
          });
        </script>
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