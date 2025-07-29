import { Context } from 'hono';
import { html, raw } from 'hono/html';
import { ConfigService } from '../../../services/config';
import { AuthService } from '../../../services/auth';

export async function playgroundGetHandler(c: Context) {
  // Check if setup is completed
  const isSetupCompleted = ConfigService.getBoolean('app.setup_completed', false);
  
  if (!isSetupCompleted) {
    return c.redirect('/setup');
  }

  // Get authentication status
  const authService = new AuthService(c.env);
  const auth = await authService.getAuthFromRequest(c);

  // Get the selected Google Sheet ID
  const sheetId = ConfigService.getString('google.sheetId');
  const storageType = ConfigService.getString('storage.type', 'r2');
  
  return c.html(html`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Sheet DB Playground</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .success-icon {
            font-size: 48px;
            color: #28a745;
            margin-bottom: 20px;
          }
          .title {
            color: #28a745;
            margin-bottom: 10px;
            font-size: 28px;
          }
          .subtitle {
            color: #6c757d;
            margin-bottom: 20px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }
          .info-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .info-card h3 {
            margin-top: 0;
            color: #495057;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .info-card p {
            margin: 10px 0;
            color: #6c757d;
          }
          .info-card .value {
            font-family: monospace;
            background: #f8f9fa;
            padding: 5px 10px;
            border-radius: 4px;
            color: #495057;
          }
          .api-section {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
          }
          .api-section h2 {
            margin-top: 0;
            color: #495057;
            border-bottom: 2px solid #dee2e6;
            padding-bottom: 10px;
          }
          .endpoint {
            margin-bottom: 30px;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
          }
          .method {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 12px;
            margin-right: 10px;
          }
          .method.get { background: #d4edda; color: #155724; }
          .method.post { background: #cce5ff; color: #004085; }
          .method.put { background: #fff3cd; color: #856404; }
          .method.delete { background: #f8d7da; color: #721c24; }
          .endpoint-url {
            font-family: monospace;
            font-size: 16px;
            color: #495057;
          }
          .endpoint-description {
            margin: 10px 0;
            color: #6c757d;
          }
          .test-button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
            margin-top: 10px;
          }
          .test-button.primary {
            background-color: #007bff;
            color: white;
          }
          .test-button.secondary {
            background-color: #6c757d;
            color: white;
          }
          .test-button:hover {
            opacity: 0.9;
          }
          .response-area {
            margin-top: 15px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
            max-height: 300px;
            overflow-y: auto;
            display: none;
          }
          .file-upload {
            margin: 10px 0;
          }
          .file-upload input[type="file"] {
            margin-bottom: 10px;
          }
          .external-links {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .external-links h2 {
            margin-top: 0;
            color: #495057;
          }
          .link-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
          }
          .external-link {
            display: block;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            text-decoration: none;
            color: #495057;
            border: 1px solid #dee2e6;
            transition: all 0.2s;
          }
          .external-link:hover {
            background: #e9ecef;
            border-color: #adb5bd;
            text-decoration: none;
          }
          .external-link strong {
            display: block;
            margin-bottom: 5px;
            color: #007bff;
          }
        </style>
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
            ${auth ? raw(`
              <p>Status: <span style="color: #28a745; font-weight: bold;">✓ Authenticated</span></p>
              <p>User: ${auth.user.name} (${auth.user.email})</p>
              <div style="margin-top: 10px;">
                <button class="test-button secondary" onclick="logout()">Logout</button>
              </div>
            `) : raw(`
              <p>Status: <span style="color: #dc3545; font-weight: bold;">✗ Not authenticated</span></p>
              <p>Some APIs require authentication.</p>
              <div style="margin-top: 10px;">
                <button class="test-button primary" onclick="login()">Login with Auth0</button>
              </div>
            `)}
          </div>

          <div class="info-card">
            <h3>📊 Connected Sheet</h3>
            <p>Google Sheet ID:</p>
            <div class="value">${sheetId || 'Not configured'}</div>
            ${sheetId ? raw(`<p><a href="https://docs.google.com/spreadsheets/d/${sheetId}" target="_blank">Open in Google Sheets →</a></p>`) : ''}
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
            <div class="value">${c.req.url.split('/playground')[0]}/api/v1</div>
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
            ${sheetId ? raw(`
              <a href="https://docs.google.com/spreadsheets/d/${sheetId}" target="_blank" class="external-link">
                <strong>📊 Google Sheets</strong>
                View and edit your connected spreadsheet
              </a>
            `) : ''}
            
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
          </div>
        </div>

        <script>
          // Authentication functions
          function login() {
            window.location.href = '/api/v1/auth/login';
          }
          
          async function logout() {
            try {
              const response = await fetch('/api/v1/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'X-Requested-With': 'XMLHttpRequest'
                }
              });
              
              if (response.ok) {
                window.location.reload();
              } else {
                alert('Logout failed');
              }
            } catch (error) {
              alert('Logout error: ' + error.message);
            }
          }

          async function testEndpoint(method, url, body, responseId) {
            const responseEl = document.getElementById(responseId);
            responseEl.style.display = 'block';
            responseEl.textContent = 'Loading...';
            
            try {
              const options = {
                method: method,
                headers: {
                  'Content-Type': 'application/json'
                }
              };
              
              if (body) {
                options.body = JSON.stringify(body);
              }
              
              const response = await fetch(url, options);
              const data = await response.json();
              
              responseEl.textContent = \`Status: \${response.status}\\n\\n\${JSON.stringify(data, null, 2)}\`;
            } catch (error) {
              responseEl.textContent = \`Error: \${error.message}\`;
            }
          }
          
          async function testSheetCreation(responseId) {
            await testEndpoint('POST', '/api/v1/sheets', { name: '_Role' }, responseId);
          }
          
          async function testUserSheetCreation(responseId) {
            await testEndpoint('POST', '/api/v1/sheets', { name: '_User' }, responseId);
          }
          
          async function testFileUpload(responseId) {
            const fileInput = document.getElementById('test-file');
            const file = fileInput.files[0];
            
            if (!file) {
              alert('Please select a file first');
              return;
            }
            
            const responseEl = document.getElementById(responseId);
            responseEl.style.display = 'block';
            responseEl.textContent = 'Uploading...';
            
            try {
              const formData = new FormData();
              formData.append('file', file);
              
              const response = await fetch('/api/v1/storages', {
                method: 'POST',
                body: formData
              });
              
              const data = await response.json();
              responseEl.textContent = \`Status: \${response.status}\\n\\n\${JSON.stringify(data, null, 2)}\`;
              
              // If upload was successful, store the file ID for delete testing
              if (data.fileId) {
                document.getElementById('file-id-input').value = data.fileId;
              }
            } catch (error) {
              responseEl.textContent = \`Error: \${error.message}\`;
            }
          }
          
          async function testFileDelete(responseId) {
            const fileId = document.getElementById('file-id-input').value;
            
            if (!fileId) {
              alert('Please enter a file ID');
              return;
            }
            
            const responseEl = document.getElementById(responseId);
            responseEl.style.display = 'block';
            responseEl.textContent = 'Deleting...';
            
            try {
              const response = await fetch(\`/api/v1/storages/\${fileId}\`, {
                method: 'DELETE'
              });
              
              const data = await response.json();
              responseEl.textContent = \`Status: \${response.status}\\n\\n\${JSON.stringify(data, null, 2)}\`;
            } catch (error) {
              responseEl.textContent = \`Error: \${error.message}\`;
            }
          }
        </script>
      </body>
    </html>
  `);
}