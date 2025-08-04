import { html } from 'hono/html';
import { HtmlEscapedString } from 'hono/utils/html';

interface LoginFormProps {
  csrfToken: string;
}

export function LoginForm({ csrfToken }: LoginFormProps) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Configuration Management - SheetDB</title>
      <link rel="stylesheet" href="/statics/config/style.css">
    </head>
    <body>
      <div class="auth-form" id="auth-form">
        <h1>⚙️ Configuration Management</h1>
        <p>A password is required to access the configuration screen.</p>
        <form id="password-form">
          <input type="hidden" name="csrf_token" value="${csrfToken}">
          <input type="password" name="password" id="password-input" placeholder="Configuration Password" required>
          <button type="submit">Login</button>
        </form>
        <div class="error" id="error" style="display: none;"></div>
      </div>

      <div class="config-container" id="config-container" style="display: none;">
        <a href="/playground" class="back-link">← Back to Playground</a>
        
        <div class="header">
          <h1>⚙️ Configuration Management</h1>
          <p>Manage your application configuration settings</p>
          <button type="button" class="logout-btn" id="logout-btn">Logout</button>
        </div>

        <div class="config-actions">
          <button type="button" class="btn btn-primary" id="add-config-btn">Add Configuration</button>
        </div>

        <div class="config-table">
          <table id="config-table">
            <thead>
              <tr>
                <th>Configuration Key</th>
                <th>Value</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="3">Loading...</td></tr>
            </tbody>
          </table>
        </div>
        
        <!-- Template definitions -->
        <template id="config-row-template">
          <tr>
            <td class="config-key"></td>
            <td class="config-value"></td>
            <td class="config-description"></td>
          </tr>
        </template>

        <template id="config-value-text-template">
          <span class="config-text-value"></span>
        </template>

        <template id="config-value-secret-template">
          <span class="config-secret-value">*****</span>
        </template>

        <template id="config-value-boolean-template">
          <input type="checkbox" class="config-boolean-value" disabled>
        </template>
      </div>

      <!-- Add Configuration Modal -->
      <div class="modal" id="add-config-modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Add Configuration</h2>
            <button type="button" class="modal-close" id="modal-close-btn">&times;</button>
          </div>
          <form id="add-config-form" class="modal-body">
            <div class="form-group">
              <label for="config-key">Configuration Key *</label>
              <input type="text" id="config-key" name="key" placeholder="e.g. app.feature_enabled" required>
            </div>
            <div class="form-group">
              <label for="config-type">Data Type *</label>
              <select id="config-type" name="type" required>
                <option value="string">String</option>
                <option value="boolean">Boolean</option>
                <option value="number">Number</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <div class="form-group">
              <label for="config-value">Value *</label>
              <input type="text" id="config-value" name="value" placeholder="Enter configuration value" required>
            </div>
            <div class="form-group">
              <label for="config-description">Description</label>
              <textarea id="config-description" name="description" placeholder="Optional description for this configuration"></textarea>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
              <button type="submit" class="btn btn-primary">Add</button>
            </div>
            <div class="modal-error" id="modal-error" style="display: none;"></div>
          </form>
        </div>
      </div>

      <script src="/statics/config/client.js"></script>
    </body>
    </html>
  `;
}