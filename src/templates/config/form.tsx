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
                      <input 
                        type="checkbox" 
                        name="${config.key}" 
                        ${config.value === 'true' ? 'checked' : ''}
                        data-original="${config.value}"
                      >
                    ` : html`
                      <div class="input-group">
                        <input 
                          type="${config.isSensitive ? 'password' : 'text'}" 
                          name="${config.key}"
                          value="${config.value}" 
                          data-original="${config.value}"
                          data-field-type="${config.isSensitive ? 'sensitive' : 'normal'}"
                          class="config-input"
                        >
                        <button type="button" class="reset-btn" title="Reset to original value" data-key="${config.key}">↺</button>
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

      <script src="/statics/config/client.js"></script>
    </body>
    </html>
  `;
}