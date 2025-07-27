interface SheetInitializationProps {
  accessToken: string;
  configPassword: string;
  isSetupCompleted?: boolean;
  isAuthenticated?: boolean;
  error?: string;
}

export default function SheetInitializationTemplate({ accessToken, configPassword, isSetupCompleted, isAuthenticated, error }: SheetInitializationProps) {
  return (
    <html>
      <head>
        <title>Sheet Configuration</title>
        <style>{`
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .config-container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .success-icon {
            font-size: 48px;
            color: #28a745;
            margin-bottom: 20px;
          }
          .title {
            color: #28a745;
            margin-bottom: 10px;
            font-size: 24px;
          }
          .subtitle {
            color: #6c757d;
            margin-bottom: 30px;
          }
          .section {
            margin-bottom: 30px;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
          }
          .section h3 {
            margin-top: 0;
            color: #495057;
          }
          .form-group {
            margin-bottom: 20px;
          }
          .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #495057;
          }
          .form-group input, .form-group select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 16px;
          }
          .radio-group {
            display: flex;
            gap: 20px;
          }
          .radio-option {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .status {
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 20px;
          }
          .status.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }
          .status.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
          }
          .status.info {
            background-color: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
          }
          .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin: 0 10px 10px 0;
          }
          .btn-primary {
            background-color: #007bff;
            color: white;
          }
          .btn-primary:hover:not(:disabled) {
            background-color: #0056b3;
          }
          .btn-primary:disabled {
            background-color: #6c757d;
            color: #fff;
            cursor: not-allowed;
            opacity: 0.65;
          }
          .btn-secondary {
            background-color: #6c757d;
            color: white;
          }
          .btn-secondary:hover {
            background-color: #5a6268;
          }
          .hidden {
            display: none;
          }
          .loading {
            text-align: center;
            color: #6c757d;
            padding: 20px;
          }
          .sheet-progress {
            margin-top: 20px;
          }
          .sheet-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 15px;
            margin-bottom: 10px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            background-color: #f8f9fa;
          }
          .sheet-item span:first-child {
            font-weight: bold;
            min-width: 120px;
          }
          .status-indicator {
            min-width: 100px;
            text-align: right;
          }
          .status-indicator.success {
            color: #28a745;
          }
          .status-indicator.error {
            color: #dc3545;
          }
          .status-indicator.loading {
            color: #007bff;
          }
          .auth-form {
            text-align: center;
            max-width: 400px;
            margin: 0 auto;
          }
          .form-group {
            margin-bottom: 20px;
            text-align: left;
          }
          .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #495057;
          }
          .form-group input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 16px;
          }
          .error-message {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 20px;
          }
        `}</style>
      </head>
      <body>
        <div className="config-container">
          {isSetupCompleted && !isAuthenticated ? (
            <div>
              <div className="header">
                <div className="success-icon">🔒</div>
                <h1 className="title">Authentication Required</h1>
                <p className="subtitle">Please enter your configuration password to proceed</p>
              </div>
              
              <div className="auth-form">
                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}
                
                <form method="POST">
                  <div className="form-group">
                    <label htmlFor="password">Configuration Password:</label>
                    <input 
                      type="password" 
                      id="password" 
                      name="password" 
                      required 
                      autoFocus
                    />
                  </div>
                  
                  <button type="submit" className="btn btn-primary">
                    Authenticate
                  </button>
                  <button type="button" className="btn btn-secondary" onclick="window.close()">
                    Cancel
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div>
              <div className="header">
                <div className="success-icon">⚙️</div>
                <h1 className="title">Sheet Configuration</h1>
                <p className="subtitle">Configure file storage and initialize database sheets</p>
              </div>

          <div id="status-messages"></div>

          <div className="section">
            <h3>📁 File Storage Configuration</h3>
            <p>Choose where uploaded files will be stored:</p>
            
            <div className="form-group">
              <div className="radio-group">
                <div className="radio-option">
                  <input type="radio" id="storage-r2" name="storage" value="r2" checked />
                  <label htmlFor="storage-r2">Cloudflare R2 (Recommended)</label>
                </div>
                <div className="radio-option">
                  <input type="radio" id="storage-gdrive" name="storage" value="gdrive" />
                  <label htmlFor="storage-gdrive">Google Drive</label>
                </div>
              </div>
            </div>

            <div id="r2-config" className="storage-config">
              <div className="form-group">
                <label htmlFor="r2-bucket">R2 Bucket Name</label>
                <input type="text" id="r2-bucket" placeholder="your-bucket-name" />
              </div>
              <div className="form-group">
                <label htmlFor="r2-access-key">R2 Access Key ID</label>
                <input type="text" id="r2-access-key" placeholder="Access Key ID" />
              </div>
              <div className="form-group">
                <label htmlFor="r2-secret-key">R2 Secret Access Key</label>
                <input type="password" id="r2-secret-key" placeholder="Secret Access Key" />
              </div>
              <div className="form-group">
                <label htmlFor="r2-endpoint">R2 Endpoint URL</label>
                <input type="text" id="r2-endpoint" placeholder="https://your-account-id.r2.cloudflarestorage.com" />
              </div>
            </div>

            <div id="gdrive-config" className="storage-config hidden">
              <div className="form-group">
                <label htmlFor="gdrive-folder">Google Drive Folder ID</label>
                <input type="text" id="gdrive-folder" placeholder="Folder ID from Google Drive URL" />
              </div>
              <p><small>To get the folder ID, create a folder in Google Drive and copy the ID from the URL.</small></p>
            </div>
          </div>

          <div className="section">
            <h3>📊 Database Sheet Initialization</h3>
            <p>Initialize the required system sheets for user management and role-based access:</p>
            
            <div id="sheet-init-status" className="status info">
              <strong>Ready to initialize:</strong> _User and _Role sheets will be created in your selected spreadsheet.
            </div>

            <div className="sheet-progress">
              <div className="sheet-item">
                <span>👥 _Role Sheet</span>
                <span id="role-status" className="status-indicator">Waiting...</span>
              </div>
              <div className="sheet-item">
                <span>👤 _User Sheet</span>
                <span id="user-status" className="status-indicator">Waiting...</span>
              </div>
            </div>

            <button id="init-sheets-btn" className="btn btn-primary">
              Initialize Database Sheets
            </button>
          </div>

          <div className="section">
            <h3>🚀 Finalize Setup</h3>
            <button id="complete-setup-btn" className="btn btn-primary" disabled>
              Complete Setup & Go to Playground
            </button>
            <button className="btn btn-secondary" onclick="window.close()">
              Cancel
            </button>
          </div>
            </div>
          )}
        </div>

        {(!isSetupCompleted || isAuthenticated) && (
          <>
            <div id="auth-data" style="display: none;" data-access-token={accessToken} data-config-password={configPassword}></div>
            <script dangerouslySetInnerHTML={{
            __html: `
              let storageConfigured = false;
              let roleSheetInitialized = false;
              let userSheetInitialized = false;
              
              // Get auth data from data attributes
              const authData = document.getElementById('auth-data');
              const accessToken = authData.dataset.accessToken;
              const configPassword = authData.dataset.configPassword;

            // Storage type toggle
            document.querySelectorAll('input[name="storage"]').forEach(radio => {
              radio.addEventListener('change', function() {
                document.getElementById('r2-config').classList.toggle('hidden', this.value !== 'r2');
                document.getElementById('gdrive-config').classList.toggle('hidden', this.value !== 'gdrive');
              });
            });

            // Initialize all sheets
            document.getElementById('init-sheets-btn').addEventListener('click', async function() {
              this.disabled = true;
              this.textContent = 'Initializing...';
              
              try {
                // Initialize _Role sheet first
                await initializeSheet('_Role', 'role');
                
                // Then initialize _User sheet
                await initializeSheet('_User', 'user');
                
                // Both completed successfully
                updateCompleteButton();
                showStatus('All sheets initialized successfully!', 'success');
                this.textContent = '✓ Completed';
                this.style.backgroundColor = '#28a745';
                
              } catch (error) {
                showStatus('Failed to initialize sheets: ' + error.message, 'error');
                this.disabled = false;
                this.textContent = 'Initialize Database Sheets';
              }
            });

            // Complete setup
            document.getElementById('complete-setup-btn').addEventListener('click', async function() {
              this.disabled = true;
              this.textContent = 'Completing...';
              
              try {
                await saveConfigAndCompleteSetup();
                showStatus('Setup completed! Redirecting to playground...', 'success');
                setTimeout(() => {
                  window.opener.postMessage({
                    type: 'setup-completed'
                  }, window.location.origin);
                  window.close();
                }, 2000);
              } catch (error) {
                showStatus('Failed to complete setup: ' + error.message, 'error');
                this.disabled = false;
                this.textContent = 'Complete Setup & Go to Playground';
              }
            });

            async function initializeSheet(sheetName, type) {
              const statusElement = document.getElementById(\`\${type}-status\`);
              
              statusElement.textContent = 'Initializing...';
              statusElement.className = 'status-indicator loading';
              
              try {
                const response = await fetch('/api/v1/sheets', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ name: sheetName })
                });

                if (!response.ok) {
                  const error = await response.json();
                  throw new Error(error.message || \`Failed to initialize \${sheetName} sheet\`);
                }
                
                // Success
                statusElement.textContent = '✓ Ready';
                statusElement.className = 'status-indicator success';
                
                if (type === 'role') {
                  roleSheetInitialized = true;
                } else if (type === 'user') {
                  userSheetInitialized = true;
                }
                
              } catch (error) {
                statusElement.textContent = '✗ Failed';
                statusElement.className = 'status-indicator error';
                throw error; // Re-throw to be caught by the main handler
              }
            }

            async function saveConfigAndCompleteSetup() {
              const storageType = document.querySelector('input[name="storage"]:checked').value;
              const storage = { type: storageType };

              if (storageType === 'r2') {
                storage.r2 = {
                  bucket: document.getElementById('r2-bucket').value,
                  accessKeyId: document.getElementById('r2-access-key').value,
                  secretAccessKey: document.getElementById('r2-secret-key').value,
                  endpoint: document.getElementById('r2-endpoint').value
                };
              } else {
                storage.gdrive = {
                  folderId: document.getElementById('gdrive-folder').value
                };
              }

              // Save configuration first
              showStatus('Saving storage configuration...', 'info');

              const response = await fetch('/api/v1/setup', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + configPassword
                },
                body: JSON.stringify({
                  storage: storage
                })
              });

              if (!response.ok) {
                throw new Error('Failed to save configuration');
              }

              // Test storage by trying to upload a test file
              showStatus('Testing storage configuration...', 'info');
              
              const testFileData = new FormData();
              testFileData.append('file', new Blob(['Test file for storage verification'], { type: 'text/plain' }), 'test.txt');
              
              const uploadResponse = await fetch('/api/v1/storages', {
                method: 'POST',
                headers: { 
                  'Authorization': 'Bearer ' + configPassword
                },
                body: testFileData
              });

              if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error('Storage upload test failed: ' + (errorData.message || 'Unknown error'));
              }

              const uploadResult = await uploadResponse.json();
              const testFileId = uploadResult.fileId;

              showStatus('Storage upload successful. Testing delete...', 'success');

              // Test delete
              const deleteResponse = await fetch(\`/api/v1/storages/\${testFileId}\`, {
                method: 'DELETE',
                headers: { 
                  'Authorization': 'Bearer ' + configPassword
                }
              });

              if (!deleteResponse.ok) {
                console.warn('Storage delete test failed, but upload works');
              }

              showStatus('Storage configuration verified successfully!', 'success');
              
              // Redirect to playground
              setTimeout(() => {
                window.location.href = '/playground';
              }, 1500);
            }

            function updateCompleteButton() {
              const completeBtn = document.getElementById('complete-setup-btn');
              const sheetsInitialized = roleSheetInitialized && userSheetInitialized;
              completeBtn.disabled = !sheetsInitialized;
              
              if (sheetsInitialized) {
                completeBtn.textContent = 'Complete Setup & Go to Playground';
              }
            }

            function showStatus(message, type) {
              const statusDiv = document.getElementById('status-messages');
              statusDiv.innerHTML = \`<div class="status \${type}">\${message}</div>\`;
            }
            `
          }} />
          </>
        )}
      </body>
    </html>
  );
}