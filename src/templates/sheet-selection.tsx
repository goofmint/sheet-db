interface SheetSelectionProps {
  accessToken: string;
  configPassword: string;
  isSetupCompleted?: boolean;
  isAuthenticated?: boolean;
  error?: string;
}

export default function SheetSelectionTemplate({ accessToken, configPassword, isSetupCompleted, isAuthenticated, error }: SheetSelectionProps) {
  return (
    <html>
      <head>
        <title>Select Google Sheets</title>
        <link rel="stylesheet" href="/statics/sheet-selection/style.css" />
      </head>
      <body>
        <div className="selection-container">
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
                  <button type="button" className="btn btn-secondary" id="cancel-auth-btn">
                    Cancel
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div>
              <div className="header">
                <div className="success-icon">✅</div>
                <h1 className="title">Authentication Successful</h1>
                <p className="subtitle">Please select a Google Sheet to use with SheetDB</p>
              </div>
              
              <div id="sheets-list" className="sheets-list">
                <div className="loading">Loading your Google Sheets...</div>
              </div>
              
              <div className="buttons">
                <button id="select-btn" className="btn btn-primary" disabled>
                  Select Sheet
                </button>
                <button className="btn btn-secondary" id="cancel-success-btn">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {(!isSetupCompleted || isAuthenticated) && (
          <>
            <div id="auth-data" style="display: none;" data-access-token={accessToken} data-config-password={configPassword}></div>
            <script src="/statics/sheet-selection/app.js"></script>
          </>
        )}
      </body>
    </html>
  );
}