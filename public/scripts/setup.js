class SetupManager {
  constructor() {
    // Get DOM elements with null checks
    this.setupForm = document.getElementById('setup-form');
    this.authForm = document.getElementById('auth-form');
    this.submitButton = document.getElementById('submit-button');
    this.loadingIndicator = document.getElementById('loading');
    
    // Validate that required elements exist
    const requiredElements = [
      { element: this.setupForm, name: 'setup-form' },
      { element: this.authForm, name: 'auth-form' },
      { element: this.submitButton, name: 'submit-button' },
      { element: this.loadingIndicator, name: 'loading' }
    ];
    
    const missingElements = requiredElements
      .filter(({ element }) => !element)
      .map(({ name }) => name);
    
    if (missingElements.length > 0) {
      throw new Error(`Required DOM elements not found: ${missingElements.join(', ')}`);
    }
    
    this.isAuthenticated = false;
    this.sessionToken = null;
    
    this.init();
  }

  async init() {
    await this.checkSetupStatus();
    this.initializeEventListeners();
  }

  async checkSetupStatus() {
    try {
      const headers = {};
      if (this.isAuthenticated && this.sessionToken) {
        headers['Authorization'] = 'Bearer ' + this.sessionToken;
      }
      
      const response = await fetch('/api/v1/setup', { headers });
      
      if (response.status === 200) {
        const data = await response.json();
        this.handleSetupStatus(data);
      } else if (response.status === 401) {
        this.showAuthSection();
      } else {
        throw new Error('Failed to fetch setup status');
      }
    } catch (error) {
      console.error('Setup status check failed:', error);
      this.showError('Failed to check setup status');
    }
  }

  handleSetupStatus(data) {
    const statusElement = document.getElementById('setup-status');
    
    if (data.setup.isCompleted) {
      statusElement.className = 'setup-status configured';
      statusElement.innerHTML = '<span class="status-icon">✅</span><span class="status-text">Setup completed</span>';
      this.showConfigSummary(data.setup.currentConfig);
      this.populateForm(data.setup.currentConfig);
    } else {
      statusElement.className = 'setup-status not-configured';
      statusElement.innerHTML = '<span class="status-icon">⚠️</span><span class="status-text">Setup required</span>';
      this.populateForm(data.setup.currentConfig);
    }
  }

  showAuthSection() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('setup-form-section').style.display = 'none';
    
    const statusElement = document.getElementById('setup-status');
    statusElement.className = 'setup-status configured';
    statusElement.innerHTML = '<span class="status-icon">🔒</span><span class="status-text">Authentication required</span>';
  }

  showConfigSummary(config) {
    const configItems = document.getElementById('config-items');
    const hasGoogle = config.google?.clientId && config.google?.clientSecret;
    const hasAuth0 = config.auth0?.domain && config.auth0?.clientId;
    
    configItems.innerHTML = `
      <div class="config-item">
        <label>Google OAuth:</label>
        <span class="config-value">${hasGoogle ? 'Configured (Client ID: ' + config.google.clientId.substring(0, 20) + '...)' : 'Not configured'}</span>
      </div>
      <div class="config-item">
        <label>Auth0:</label>
        <span class="config-value">${hasAuth0 ? 'Configured (Domain: ' + config.auth0.domain + ')' : 'Not configured'}</span>
      </div>
      <div class="config-item">
        <label>Configuration Password:</label>
        <span class="config-value">Configured</span>
      </div>
    `;
    
    document.getElementById('status-display').style.display = 'block';
  }

  populateForm(config) {
    if (config.google?.clientId) {
      document.getElementById('google-client-id').value = config.google.clientId;
    }
    if (config.google?.clientSecret) {
      document.getElementById('google-client-secret').value = config.google.clientSecret;
    }
    if (config.auth0?.domain) {
      document.getElementById('auth0-domain').value = config.auth0.domain;
    }
    if (config.auth0?.clientId) {
      document.getElementById('auth0-client-id').value = config.auth0.clientId;
    }
    if (config.auth0?.clientSecret) {
      document.getElementById('auth0-client-secret').value = config.auth0.clientSecret;
    }
  }

  initializeEventListeners() {
    // セットアップフォーム送信
    this.setupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitSetup();
    });

    // 認証ボタン
    const authButton = document.getElementById('auth-button');
    if (authButton) {
      authButton.addEventListener('click', () => {
        this.authenticate();
      });
    }
    
    // 認証フォーム送信 (Enterキー対応)
    if (this.authForm) {
      this.authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.authenticate();
      });
    }


    // シート選択ボタン
    const selectSheetButton = document.getElementById('select-sheet-button');
    if (selectSheetButton) {
      selectSheetButton.addEventListener('click', () => this.showSheetSelection());
    }

    // シート初期化ボタン
    const initUserSheetButton = document.getElementById('init-user-sheet');
    if (initUserSheetButton) {
      initUserSheetButton.addEventListener('click', () => this.initializeUserSheet());
    }

    const initRoleSheetButton = document.getElementById('init-role-sheet');
    if (initRoleSheetButton) {
      initRoleSheetButton.addEventListener('click', () => this.initializeRoleSheet());
    }

    // フィールドバリデーション
    const fields = this.setupForm.querySelectorAll('input[required]');
    fields.forEach(field => {
      field.addEventListener('blur', () => this.validateField(field));
      field.addEventListener('input', () => this.clearFieldError(field));
    });
  }

  async authenticate() {
    const passwordField = document.getElementById('config-password-auth');
    const password = passwordField.value;
    
    // Clear the password field immediately for security
    passwordField.value = '';
    
    try {
      const response = await fetch('/api/v1/setup', {
        headers: {
          'Authorization': 'Bearer ' + password
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.isAuthenticated = true;
        // Store session token or auth state instead of password
        this.sessionToken = password; // This should ideally be a session token from the server
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('setup-form-section').style.display = 'block';
        this.handleSetupStatus(data);
      } else {
        this.showFieldError('config-password-auth', 'Configuration password is incorrect');
        this.isAuthenticated = false;
      }
    } catch (error) {
      this.showError('Authentication failed');
      this.isAuthenticated = false;
    }
    
    // Clear the password variable from memory
    // Note: This doesn't guarantee immediate memory clearing but helps
    password = null;
  }

  async submitSetup() {
    if (!this.validateForm()) return;

    this.setLoading(true);

    const formData = this.getFormData();
    
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.isAuthenticated && this.sessionToken) {
        headers['Authorization'] = 'Bearer ' + this.sessionToken;
      }

      const response = await fetch('/api/v1/setup', {
        method: 'POST',
        headers,
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        this.showSuccess('Setup saved successfully! Starting Google authentication...');
        // 設定保存後、Google認証を開始
        setTimeout(() => {
          this.startGoogleAuthentication();
        }, 1000);
      } else {
        const errorData = await response.json();
        this.handleSubmissionError(errorData);
      }
    } catch (error) {
      this.showError('Setup failed: ' + error.message);
    } finally {
      this.setLoading(false);
    }
  }

  getFormData() {
    return {
      google: {
        clientId: document.getElementById('google-client-id').value,
        clientSecret: document.getElementById('google-client-secret').value
      },
      auth0: {
        domain: document.getElementById('auth0-domain').value,
        clientId: document.getElementById('auth0-client-id').value,
        clientSecret: document.getElementById('auth0-client-secret').value
      },
      app: {
        configPassword: document.getElementById('config-password').value
      }
    };
  }

  validateForm() {
    let isValid = true;
    const fields = this.setupForm.querySelectorAll('input[required]');
    
    fields.forEach(field => {
      if (!this.validateField(field)) {
        isValid = false;
      }
    });

    return isValid;
  }

  validateField(field) {
    const value = field.value.trim();
    const name = field.name;
    let error = null;

    if (field.required && !value) {
      error = 'This field is required';
    } else if (value) {
      switch (name) {
        case 'google.clientId':
          if (!value.endsWith('.googleusercontent.com')) {
            error = 'Invalid Google Client ID format';
          }
          break;
        case 'auth0.domain':
          if (!/^[a-zA-Z0-9-]+\.(auth0\.com|[a-z]{2}\.auth0\.com)$/.test(value)) {
            error = 'Invalid Auth0 domain format';
          }
          break;
        case 'auth0.clientId':
          if (value.length !== 32) {
            error = 'Auth0 Client ID must be 32 characters';
          }
          break;
        case 'auth0.clientSecret':
          if (value.length < 48) {
            error = 'Auth0 Client Secret must be at least 48 characters';
          }
          break;
        case 'app.configPassword': {
          const errors = [];
          if (value.length < 8) errors.push('at least 8 characters');
          if (!/[A-Z]/.test(value)) errors.push('uppercase letter');
          if (!/[a-z]/.test(value)) errors.push('lowercase letter');
          if (!/[0-9]/.test(value)) errors.push('number');
          if (errors.length > 0) {
            error = `Password must contain ${errors.join(', ')}`;
          }
          break;
        }
      }
    }

    if (error) {
      this.showFieldError(field.id, error);
      return false;
    } else {
      this.clearFieldError(field);
      return true;
    }
  }

  showFieldError(fieldId, message) {
    const errorElement = document.getElementById(fieldId + '-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add('show');
    }
  }

  clearFieldError(field) {
    const errorElement = document.getElementById(field.id + '-error');
    if (errorElement) {
      errorElement.classList.remove('show');
      errorElement.textContent = '';
    }
  }

  handleSubmissionError(errorData) {
    if (errorData.error && errorData.error.details) {
      errorData.error.details.forEach(detail => {
        this.showFieldError(detail.field.replace('.', '-'), detail.message);
      });
    } else {
      this.showError(errorData.error?.message || 'Setup failed');
    }
  }

  showSuccess(message) {
    const element = document.getElementById('success-message');
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => element.style.display = 'none', 5000);
  }

  showError(message) {
    const element = document.getElementById('error-message');
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => element.style.display = 'none', 5000);
  }

  setLoading(loading) {
    this.submitButton.disabled = loading;
    this.loadingIndicator.style.display = loading ? 'flex' : 'none';
  }

  // Google認証機能
  async startGoogleAuthentication() {
    const clientId = document.getElementById('google-client-id').value;
    const clientSecret = document.getElementById('google-client-secret').value;
    
    if (!clientId || !clientSecret) {
      this.showError('Google Client ID and Client Secret are required');
      return;
    }

    try {
      // OAuth2認証フローの開始
      const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(window.location.origin + '/google/callback')}&scope=${encodeURIComponent('https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file')}&response_type=code&access_type=offline`;
      
      // 現在のページから認証URLにリダイレクト
      window.location.href = authUrl;
      
    } catch (error) {
      this.showError('Failed to start Google authentication: ' + error.message);
    }
  }


  // Googleシート選択機能
  async showSheetSelection() {
    if (!this.googleAccessToken) {
      this.showError('Please authenticate with Google first');
      return;
    }

    try {
      // Google Sheets APIを使用してシート一覧を取得
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        headers: {
          'Authorization': 'Bearer ' + this.googleAccessToken
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Google Sheets');
      }

      const data = await response.json();
      this.displaySheetSelectionModal(data.files || []);
      
    } catch (error) {
      this.showError('Failed to load Google Sheets: ' + error.message);
    }
  }

  displaySheetSelectionModal(sheets) {
    // モーダルを動的に作成
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Select Google Sheet</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="sheet-list">
            ${sheets.map(sheet => `
              <div class="sheet-item" data-sheet-id="${sheet.id}">
                <div class="sheet-name">${sheet.name}</div>
                <div class="sheet-id">${sheet.id}</div>
                <button class="select-button">Select</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // イベントリスナーを追加
    modal.querySelector('.modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.querySelectorAll('.select-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const sheetItem = e.target.closest('.sheet-item');
        const sheetId = sheetItem.dataset.sheetId;
        const sheetName = sheetItem.querySelector('.sheet-name').textContent;
        
        this.selectSheet(sheetId, sheetName);
        document.body.removeChild(modal);
      });
    });
  }

  selectSheet(sheetId, sheetName) {
    document.getElementById('selected-sheet-info').innerHTML = `
      <span class="success">✅ Selected: ${sheetName}</span>
      <div class="sheet-details">Sheet ID: ${sheetId}</div>
    `;
    document.getElementById('sheet-initialization-group').style.display = 'block';
    this.selectedSheetId = sheetId;
  }

  // シート初期化機能
  async initializeUserSheet() {
    await this.initializeSheet('User', [
      ['ID', 'Email', 'Name', 'Role', 'Created At', 'Updated At']
    ]);
  }

  async initializeRoleSheet() {
    await this.initializeSheet('Role', [
      ['ID', 'Name', 'Permissions', 'Description', 'Created At', 'Updated At']
    ]);
  }

  async initializeSheet(sheetName, headers) {
    if (!this.selectedSheetId) {
      this.showError('Please select a Google Sheet first');
      return;
    }

    try {
      // Google Sheets APIを使用して新しいシートを作成
      const addSheetResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.selectedSheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this.googleAccessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }]
        })
      });

      if (!addSheetResponse.ok) {
        throw new Error(`Failed to create ${sheetName} sheet`);
      }

      // ヘッダーを追加
      const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.selectedSheetId}/values/${sheetName}!A1:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this.googleAccessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: headers
        })
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to add headers to ${sheetName} sheet`);
      }

      this.updateSheetInitStatus(sheetName, 'success');
      
    } catch (error) {
      this.updateSheetInitStatus(sheetName, 'error', error.message);
    }
  }

  updateSheetInitStatus(sheetName, status, message = '') {
    const statusElement = document.getElementById('sheet-init-status');
    const existingStatus = statusElement.innerHTML;
    
    const icon = status === 'success' ? '✅' : '❌';
    const statusText = status === 'success' ? 'Created' : 'Failed';
    const newStatus = `<div class="${status}">${icon} ${sheetName} sheet: ${statusText} ${message}</div>`;
    
    statusElement.innerHTML = existingStatus + newStatus;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SetupManager();
});