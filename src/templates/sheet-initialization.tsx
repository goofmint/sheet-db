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
        <link rel="stylesheet" href="/statics/sheet-initializations/styles.css" />
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
                
                <form method="post">
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
            <script src="/statics/sheet-initializations/script.js"></script>
          </>
        )}
      </body>
    </html>
  );
}