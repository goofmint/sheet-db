import { html, raw } from 'hono/html';

interface AuthUser {
  name: string;
  email: string;
}

interface AuthData {
  user: AuthUser;
}

interface PlaygroundProps {
  auth: AuthData | null;
  sheetId: string | null;
  storageType: string;
  baseUrl: string;
}

export function playground(props: PlaygroundProps) {
  const { auth, sheetId, storageType, baseUrl } = props;
  
  return html`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Sheet DB Playground</title>
        <link rel="stylesheet" href="/statics/playground/style.css" />
      </head>
      <body>
        <div class="header">
          <div class="success-icon">🚀</div>
          <h1 class="title">Sheet DB Playground</h1>
          <p class="subtitle">Your Google Sheets API is ready! Test endpoints and explore functionality.</p>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <h3>👤 Authentication Status</h3>
            ${auth ? html`
              <p>Status: <span style="color: #28a745; font-weight: bold;">✓ Authenticated</span></p>
              <p>User: ${auth.user.name} (${auth.user.email})</p>
              <div style="margin-top: 10px;">
                <button class="test-button secondary" onclick="logout()">Logout</button>
              </div>
            ` : html`
              <p>Status: <span style="color: #dc3545; font-weight: bold;">✗ Not authenticated</span></p>
              <p>Some APIs require authentication.</p>
              <div style="margin-top: 10px;">
                <button class="test-button primary" onclick="login()">Login with Auth0</button>
              </div>
            `}
          </div>

          <div class="info-card">
            <h3>📊 Connected Sheet</h3>
            <p>Google Sheet ID:</p>
            <div class="value">${sheetId || 'Not configured'}</div>
            ${sheetId ? html`<p><a href="https://docs.google.com/spreadsheets/d/${sheetId}" target="_blank">Open in Google Sheets →</a></p>` : ''}
          </div>
          
          <div class="info-card">
            <h3>💾 Storage Configuration</h3>
            <p>Storage Type:</p>
            <div class="value">${storageType.toUpperCase()}</div>
            <p>Files uploaded via API will be stored using ${storageType === 'r2' ? 'Cloudflare R2' : 'Google Drive'}.</p>
          </div>
          
          <div class="info-card">
            <h3>🔗 API Base URL</h3>
            <p>Base URL:</p>
            <div class="value">${baseUrl}</div>
            <p>Use this base URL for all API requests.</p>
          </div>
        </div>

        <div class="api-section">
          <h2>🧪 API Testing</h2>
          
          <div class="endpoint">
            <div>
              <span class="method get">GET</span>
              <span class="endpoint-url">/api/v1/health</span>
            </div>
            <p class="endpoint-description">Check API health status</p>
            <button class="test-button primary" onclick="testEndpoint('GET', '/api/v1/health', null, 'health-response')">Test Endpoint</button>
            <div id="health-response" class="response-area"></div>
          </div>

          <div class="endpoint">
            <div>
              <span class="method get">GET</span>
              <span class="endpoint-url">/api/v1/setup</span>
            </div>
            <p class="endpoint-description">Get current setup status</p>
            <button class="test-button primary" onclick="testEndpoint('GET', '/api/v1/setup', null, 'setup-response')">Test Endpoint</button>
            <div id="setup-response" class="response-area"></div>
          </div>

          <div class="endpoint">
            <div>
              <span class="method post">POST</span>
              <span class="endpoint-url">/api/v1/sheets</span>
            </div>
            <p class="endpoint-description">Create or initialize sheets</p>
            <button class="test-button primary" onclick="testSheetCreation('sheet-response')">Test _Role Sheet Creation</button>
            <button class="test-button secondary" onclick="testUserSheetCreation('sheet-response')">Test _User Sheet Creation</button>
            <div id="sheet-response" class="response-area"></div>
          </div>

          <div class="endpoint">
            <div>
              <span class="method post">POST</span>
              <span class="endpoint-url">/api/v1/storages</span>
            </div>
            <p class="endpoint-description">Upload files to configured storage</p>
            <div class="file-upload">
              <input type="file" id="test-file" />
              <button class="test-button primary" onclick="testFileUpload('storage-response')">Upload File</button>
            </div>
            <div id="storage-response" class="response-area"></div>
          </div>

          <div class="endpoint">
            <div>
              <span class="method get">GET</span>
              <span class="endpoint-url">/api/v1/auth/me</span>
            </div>
            <p class="endpoint-description">Get current authenticated user information (requires login)</p>
            <button class="test-button primary" onclick="testEndpoint('GET', '/api/v1/auth/me', null, 'auth-me-response')">Get User Info</button>
            <div id="auth-me-response" class="response-area"></div>
          </div>

          <div class="endpoint">
            <div>
              <span class="method delete">DELETE</span>
              <span class="endpoint-url">/api/v1/storages/:id</span>
            </div>
            <p class="endpoint-description">Delete files from storage</p>
            <input type="text" id="file-id-input" placeholder="Enter file ID to delete" style="margin-right: 10px; padding: 5px;" />
            <button class="test-button primary" onclick="testFileDelete('delete-response')">Delete File</button>
            <div id="delete-response" class="response-area"></div>
          </div>
        </div>

        <div class="external-links">
          <h2>🔗 Quick Links</h2>
          <div class="link-grid">
            ${sheetId ? html`
              <a href="https://docs.google.com/spreadsheets/d/${sheetId}" target="_blank" class="external-link">
                <strong>📊 Google Sheets</strong>
                View and edit your connected spreadsheet
              </a>
            ` : ''}
            
            <a href="/api/v1" target="_blank" class="external-link">
              <strong>🔗 API Root</strong>
              View API information
            </a>
            
            <a href="/api/v1/health" target="_blank" class="external-link">
              <strong>💚 Health Check</strong>
              Check API status
            </a>
            
            <a href="/setup" class="external-link">
              <strong>⚙️ Setup</strong>
              Modify configuration
            </a>
            
            <a href="/config" class="external-link">
              <strong>🛠️ Config Management</strong>
              View and manage system settings
            </a>
          </div>
        </div>

        <script src="/statics/playground/app.js"></script>
      </body>
    </html>
  `;
}