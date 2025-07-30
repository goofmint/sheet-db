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
      
      // Clean the value to remove any extra quotes that might be present
      let cleanValue = String(value);
      // Remove surrounding quotes if they exist
      if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) {
        cleanValue = cleanValue.slice(1, -1);
      }
      
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
            width: 45%;
          }
          .value-input-container {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .value-column input {
            flex: 1;
            padding: 8px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            font-family: monospace;
          }
          .value-column input[type="password"] {
            font-family: Arial, sans-serif;
          }
          .value-column input[type="password"]::placeholder {
            font-size: 12px;
            color: #6c757d;
            font-style: italic;
          }
          .checkbox-container {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .value-column input[type="checkbox"] {
            width: auto;
            transform: scale(1.2);
            margin: 0;
          }
          .checkbox-label {
            font-size: 14px;
            color: #495057;
            font-weight: 500;
          }
          .description-column {
            color: #6c757d;
            font-size: 14px;
            width: 30%;
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
          .reset-btn {
            padding: 6px 8px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            background-color: #f8f9fa;
            cursor: pointer;
            font-size: 12px;
            color: #6c757d;
            flex-shrink: 0;
          }
          .reset-btn:hover {
            background-color: #e9ecef;
            color: #495057;
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
          
          /* Inline notification styles */
          .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            max-width: 400px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
          }
          .notification.show {
            opacity: 1;
            transform: translateX(0);
          }
          .notification.error {
            background-color: #dc3545;
          }
          .notification.warning {
            background-color: #ffc107;
            color: #212529;
          }
          .notification.success {
            background-color: #28a745;
          }
          .notification .close-btn {
            float: right;
            margin-left: 10px;
            cursor: pointer;
            font-weight: bold;
          }
          .notification .close-btn:hover {
            opacity: 0.7;
          }
          
          /* Modal styles */
          .modal {
            display: none;
            position: fixed;
            z-index: 1001;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
          }
          .modal.show {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .modal-content {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            max-width: 500px;
            width: 90%;
            text-align: center;
          }
          .modal-content h3 {
            margin-top: 0;
            color: #dc3545;
          }
          .modal-content .sensitive-changes {
            background-color: #fff3cd;
            padding: 10px;
            border-radius: 4px;
            margin: 15px 0;
            border-left: 4px solid #ffc107;
          }
          .modal-buttons {
            margin-top: 20px;
          }
          .modal-buttons button {
            margin: 0 10px;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .modal-buttons .btn-danger {
            background-color: #dc3545;
            color: white;
          }
          .modal-buttons .btn-secondary {
            background-color: #6c757d;
            color: white;
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

        <script>
          // Notification system
          function showNotification(message, type = 'error', duration = 5000) {
            const notification = document.createElement('div');
            notification.className = \`notification \${type}\`;
            notification.innerHTML = \`
              \${message}
              <span class="close-btn" onclick="this.parentElement.remove()">×</span>
            \`;
            
            document.body.appendChild(notification);
            
            // Trigger animation
            setTimeout(() => notification.classList.add('show'), 100);
            
            // Auto-remove after duration
            setTimeout(() => {
              notification.classList.remove('show');
              setTimeout(() => notification.remove(), 300);
            }, duration);
          }
          
          // Check for sensitive changes
          function getSensitiveChanges() {
            const sensitiveChanges = [];
            const sensitiveInputs = document.querySelectorAll('input[data-field-type="sensitive"]');
            
            sensitiveInputs.forEach(input => {
              if (!input.dataset.original && input.value !== '') {
                const key = input.name;
                const description = input.closest('tr').querySelector('.description-column').textContent;
                sensitiveChanges.push({ key, description });
              }
            });
            
            return sensitiveChanges;
          }
          
          // Show confirmation modal
          function showConfirmationModal(sensitiveChanges, callback) {
            const modal = document.getElementById('confirmationModal');
            const changesList = document.getElementById('sensitiveChangesList');
            
            changesList.innerHTML = sensitiveChanges.map(change => 
              \`<div>• \${change.description} (\${change.key})</div>\`
            ).join('');
            
            modal.classList.add('show');
            
            // Handle confirmation
            document.getElementById('confirmSubmit').onclick = () => {
              modal.classList.remove('show');
              callback(true);
            };
            
            document.getElementById('cancelSubmit').onclick = () => {
              modal.classList.remove('show');
              callback(false);
            };
            
            // Close on background click
            modal.onclick = (e) => {
              if (e.target === modal) {
                modal.classList.remove('show');
                callback(false);
              }
            };
          }

          // Track changes and update UI
          function updateChangesCount() {
            const changedInputs = document.querySelectorAll('input[data-original]');
            const sensitiveInputs = document.querySelectorAll('input[data-field-type="sensitive"]');
            let changesCount = 0;
            
            // Check non-sensitive fields with data-original
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
            
            // Check sensitive fields (any non-empty value means changed)
            sensitiveInputs.forEach(input => {
              if (!input.dataset.original) { // Only sensitive fields without data-original
                const current = input.value;
                if (current !== '') {
                  changesCount++;
                  input.closest('tr').classList.add('changed');
                } else {
                  input.closest('tr').classList.remove('changed');
                }
              }
            });
            
            document.getElementById('changesCount').textContent = changesCount + ' changes';
          }

          // Reset individual field
          function resetField(key) {
            const input = document.querySelector(\`input[name="\${key}"]\`);
            if (input && input.dataset.original) { // Only reset non-sensitive fields with data-original
              const original = input.dataset.original;
              if (input.type === 'checkbox') {
                input.checked = original === 'true';
                // Update checkbox label
                const label = input.parentElement.querySelector('.checkbox-label');
                if (label) {
                  label.textContent = input.checked ? 'Enabled' : 'Disabled';
                }
              } else {
                input.value = original;
              }
              updateChangesCount();
            }
          }

          // Reset all fields
          function resetAllFields() {
            const inputs = document.querySelectorAll('input[data-original]');
            const sensitiveInputs = document.querySelectorAll('input[data-field-type="sensitive"]:not([data-original])');
            
            // Reset non-sensitive fields
            inputs.forEach(input => {
              const original = input.dataset.original;
              if (input.type === 'checkbox') {
                input.checked = original === 'true';
                // Update checkbox label
                const label = input.parentElement.querySelector('.checkbox-label');
                if (label) {
                  label.textContent = input.checked ? 'Enabled' : 'Disabled';
                }
              } else {
                input.value = original;
              }
            });
            
            // Clear sensitive fields
            sensitiveInputs.forEach(input => {
              input.value = '';
            });
            
            updateChangesCount();
          }

          // Enhanced client-side validation with robust patterns
          function validateField(key) {
            const input = document.querySelector(\`input[name="\${key}"]\`);
            const statusElement = document.getElementById(\`validation-\${key}\`);
            
            if (!input || !statusElement) return;
            
            const value = input.type === 'checkbox' ? input.checked.toString() : input.value;
            
            // Enhanced validation rules with regular expressions
            let isValid = true;
            let message = '';
            
            // Skip validation for empty sensitive fields (they keep current value)
            if (input.dataset.fieldType === 'sensitive' && value === '') {
              statusElement.className = 'validation-status success';
              statusElement.textContent = '✓ Will keep current';
              return;
            }
            
            if (key.includes('client_id') && value) {
              // Google OAuth client ID pattern: typically ends with .googleusercontent.com or .apps.googleusercontent.com
              const clientIdPattern = /^[0-9]+-[a-zA-Z0-9_]{32}\.apps\.googleusercontent\.com$|^[a-zA-Z0-9_-]{72}\.apps\.googleusercontent\.com$/;
              if (!clientIdPattern.test(value)) {
                isValid = false;
                message = 'Invalid client ID format (should be Google OAuth format)';
              }
            } else if (key.includes('domain') && value) {
              // Domain validation: proper FQDN format
              const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
              if (!domainPattern.test(value) || value.length > 253) {
                isValid = false;
                message = 'Invalid domain format';
              }
            } else if (key.includes('password') && value) {
              // Strong password requirements: min 8 chars, uppercase, lowercase, digit, special char
              const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
              if (value.length < 8) {
                isValid = false;
                message = 'Password must be at least 8 characters';
              } else if (!passwordPattern.test(value)) {
                isValid = false;
                message = 'Password must include uppercase, lowercase, digit, and special character';
              }
            } else if (key.includes('client_secret') && value) {
              // Client secret validation: should be a long random string
              if (value.length < 24) {
                isValid = false;
                message = 'Client secret appears too short';
              } else if (!/^[A-Za-z0-9_-]+$/.test(value)) {
                isValid = false;
                message = 'Client secret should contain only alphanumeric characters, hyphens, and underscores';
              }
            } else if (key.includes('sheetId') && value) {
              // Google Sheets ID validation
              const sheetIdPattern = /^[a-zA-Z0-9-_]{44}$/;
              if (!sheetIdPattern.test(value)) {
                isValid = false;
                message = 'Invalid Google Sheets ID format';
              }
            } else if (key.includes('rate_limit_delay') && value) {
              // Rate limit delay validation: should be a positive integer
              const numValue = parseInt(value, 10);
              if (isNaN(numValue) || numValue < 0 || !Number.isInteger(numValue) || value !== numValue.toString()) {
                isValid = false;
                message = 'Must be a positive integer (e.g., 100, 1000)';
              }
            } else if (key.includes('timeout') && value) {
              // Timeout validation: should be a positive integer
              const numValue = parseInt(value, 10);
              if (isNaN(numValue) || numValue < 0 || !Number.isInteger(numValue) || value !== numValue.toString()) {
                isValid = false;
                message = 'Must be a positive integer in milliseconds';
              }
            } else if (key.includes('port') && value) {
              // Port validation: should be between 1 and 65535
              const portValue = parseInt(value, 10);
              if (isNaN(portValue) || portValue < 1 || portValue > 65535 || value !== portValue.toString()) {
                isValid = false;
                message = 'Must be a valid port number (1-65535)';
              }
            } else if (key.includes('max_') && value) {
              // General max_ field validation: should be a positive integer
              const numValue = parseInt(value, 10);
              if (isNaN(numValue) || numValue < 0 || !Number.isInteger(numValue) || value !== numValue.toString()) {
                isValid = false;
                message = 'Must be a positive integer';
              }
            }
            
            statusElement.className = \`validation-status \${isValid ? 'success' : 'error'}\`;
            statusElement.textContent = isValid ? '✓ Valid' : \`✗ \${message}\`;
          }

          // Event listeners
          document.addEventListener('DOMContentLoaded', function() {
            // Track changes on all inputs (both with and without data-original)
            const allInputs = document.querySelectorAll('input[name]');
            allInputs.forEach(input => {
              input.addEventListener('input', function() {
                updateChangesCount();
                // Auto-validate on input
                validateField(this.name);
              });
              input.addEventListener('change', function() {
                updateChangesCount();
                // Auto-validate on change
                validateField(this.name);
                
                // Update checkbox label
                if (this.type === 'checkbox') {
                  const label = this.parentElement.querySelector('.checkbox-label');
                  if (label) {
                    label.textContent = this.checked ? 'Enabled' : 'Disabled';
                  }
                }
              });
            });

            // Reset button handlers
            document.querySelectorAll('.reset-btn').forEach(btn => {
              btn.addEventListener('click', function() {
                const key = this.dataset.key;
                resetField(key);
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
              e.preventDefault(); // Always prevent default submission
              
              // Check if there are any validation errors
              const errorElements = document.querySelectorAll('.validation-status.error');
              if (errorElements.length > 0) {
                showNotification('Please fix validation errors before saving.', 'error');
                return;
              }
              
              // Check for sensitive changes
              const sensitiveChanges = getSensitiveChanges();
              
              const proceedWithSubmission = () => {
                // Show loading state
                const submitBtn = document.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
                
                // Submit the form
                e.target.submit();
              };
              
              if (sensitiveChanges.length > 0) {
                // Show confirmation modal for sensitive changes
                showConfirmationModal(sensitiveChanges, (confirmed) => {
                  if (confirmed) {
                    proceedWithSubmission();
                  }
                });
              } else {
                // No sensitive changes, proceed normally
                proceedWithSubmission();
              }
            });

            // Initial change count and validation
            updateChangesCount();
            
            // Auto-validate all fields on page load
            allInputs.forEach(input => {
              if (input.name) {
                validateField(input.name);
              }
            });
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