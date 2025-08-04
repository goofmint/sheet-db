import { html } from 'hono/html';
import { HtmlEscapedString } from 'hono/utils/html';

interface ConfigItem {
  key: string;
  value: string;
  type: string;
  isSensitive: boolean;
  description: string;
}

interface ConfigFormProps {
  configList: ConfigItem[];
  csrfToken: string;
}

export function ConfigForm({ configList, csrfToken }: ConfigFormProps) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Configuration Management - SheetDB</title>
      <link rel="stylesheet" href="/statics/config/style.css">
    </head>
    <body>
      <a href="/playground" class="back-link">← Back to Playground</a>
      
      <div class="header">
        <form method="post" action="/config/logout" class="logout-form">
          <input type="hidden" name="csrf_token" value="${csrfToken}">
          <button type="submit" class="logout-btn">Logout</button>
        </form>
        <h1>⚙️ Configuration Management</h1>
        <p>Manage your application configuration settings</p>
      </div>

      <form id="configForm" method="post" action="/api/v1/setup">
        <input type="hidden" name="csrf_token" value="${csrfToken}">
        
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
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save All</button>
          <button type="button" class="btn btn-secondary" id="resetAll">Reset All</button>
          <span class="changes-indicator" id="changesCount">0 changes</span>
        </div>
      </form>

      <script src="/statics/config/client.js"></script>
    </body>
    </html>
  `;
}