export function SetupForm() {
  return (
    <section id="setup-form-section" className="setup-form">
      <form id="setup-form">
        <div className="section google-section">
          <h2>Google OAuth Configuration</h2>
          <div className="field-group">
            <label htmlFor="google-client-id">Client ID *</label>
            <input 
              type="text" 
              id="google-client-id" 
              name="google.clientId"
              placeholder="your-project.apps.googleusercontent.com"
              required
            />
            <div id="google-client-id-error" className="field-error"></div>
          </div>
          
          <div className="field-group">
            <label htmlFor="google-client-secret">Client Secret *</label>
            <input 
              type="password" 
              id="google-client-secret" 
              name="google.clientSecret"
              placeholder="GOCSPX-..."
              required
            />
            <div id="google-client-secret-error" className="field-error"></div>
          </div>

          <div className="field-group">
            <div id="google-auth-status" className="auth-status"></div>
            <div className="field-help">
              Authenticate to access your Google Sheets for configuration
            </div>
          </div>

          <div className="field-group" id="sheet-selection-group" style="display: none;">
            <label>Google Sheets Selection</label>
            <button type="button" id="select-sheet-button" className="secondary-button">
              <span className="icon">📊</span>
              Select Google Sheet
            </button>
            <div id="selected-sheet-info" className="selected-info"></div>
            <div className="field-help">
              Choose the Google Sheet to use as your database
            </div>
          </div>

          <div className="field-group" id="sheet-initialization-group" style="display: none;">
            <label>Sheet Initialization</label>
            <div className="initialization-controls">
              <button type="button" id="init-user-sheet" className="secondary-button">
                <span className="icon">👥</span>
                Create User Sheet
              </button>
              <button type="button" id="init-role-sheet" className="secondary-button">
                <span className="icon">🛡️</span>
                Create Role Sheet
              </button>
            </div>
            <div id="sheet-init-status" className="init-status"></div>
            <div className="field-help">
              Initialize required sheets for user and role management
            </div>
          </div>
        </div>

        <div className="section auth0-section">
          <h2>Auth0 Configuration</h2>
          <div className="field-group">
            <label htmlFor="auth0-domain">Domain *</label>
            <input 
              type="text" 
              id="auth0-domain" 
              name="auth0.domain"
              placeholder="your-domain.auth0.com"
              required
            />
            <div id="auth0-domain-error" className="field-error"></div>
          </div>
          
          <div className="field-group">
            <label htmlFor="auth0-client-id">Client ID *</label>
            <input 
              type="text" 
              id="auth0-client-id" 
              name="auth0.clientId"
              placeholder="32-character Client ID"
              required
            />
            <div id="auth0-client-id-error" className="field-error"></div>
          </div>
          
          <div className="field-group">
            <label htmlFor="auth0-client-secret">Client Secret *</label>
            <input 
              type="password" 
              id="auth0-client-secret" 
              name="auth0.clientSecret"
              placeholder="48+ character Client Secret"
              required
            />
            <div id="auth0-client-secret-error" className="field-error"></div>
          </div>
        </div>

        <div className="section app-section">
          <h2>Application Configuration</h2>
          <div className="field-group">
            <label htmlFor="config-password">Configuration Password *</label>
            <input 
              type="password" 
              id="config-password" 
              name="app.configPassword"
              placeholder="8+ chars with uppercase, lowercase, and numbers"
              required
            />
            <div id="config-password-error" className="field-error"></div>
            <div className="field-help">
              This password will be used for configuration authentication
            </div>
          </div>
        </div>


        <div className="form-actions">
          <button type="submit" className="primary-button" id="submit-button">
            Run Setup
          </button>
          <div id="loading" className="loading-indicator" style="display: none;">
            <div className="spinner"></div>
            Setting up...
          </div>
        </div>
      </form>
    </section>
  );
}