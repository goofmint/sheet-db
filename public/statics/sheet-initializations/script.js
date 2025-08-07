/**
 * Sheet Initialization Interactive Features
 * Handles storage configuration and sheet initialization
 */

// State variables
let storageConfigured = false;
let roleSheetInitialized = false;
let userSheetInitialized = false;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get auth data from data attributes
  const authData = document.getElementById('auth-data');
  if (!authData) return; // Skip if not on setup page
  
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
  const initSheetsBtn = document.getElementById('init-sheets-btn');
  if (initSheetsBtn) {
    initSheetsBtn.addEventListener('click', async function() {
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
  }

  // Complete setup
  const completeSetupBtn = document.getElementById('complete-setup-btn');
  if (completeSetupBtn) {
    completeSetupBtn.addEventListener('click', async function() {
      this.disabled = true;
      this.textContent = 'Completing...';
      
      try {
        await saveConfigAndCompleteSetup(configPassword);
        showStatus('Setup completed! Redirecting to playground...', 'success');
        setTimeout(() => {
          if (window.opener) {
            window.opener.postMessage({
              type: 'setup-completed'
            }, window.location.origin);
          }
          window.close();
        }, 2000);
      } catch (error) {
        showStatus('Failed to complete setup: ' + error.message, 'error');
        this.disabled = false;
        this.textContent = 'Complete Setup & Go to Playground';
      }
    });
  }

  /**
   * Initialize a single sheet
   */
  async function initializeSheet(sheetName, type) {
    const statusElement = document.getElementById(`${type}-status`);
    
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
        throw new Error(error.message || `Failed to initialize ${sheetName} sheet`);
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

  /**
   * Save configuration and complete setup
   */
  async function saveConfigAndCompleteSetup(configPassword) {
    const storageType = document.querySelector('input[name="storage"]:checked').value;
    const config = { 'storage.type': storageType };

    if (storageType === 'r2') {
      config['storage.r2.bucket'] = document.getElementById('r2-bucket').value;
      config['storage.r2.accessKeyId'] = document.getElementById('r2-access-key').value;
      config['storage.r2.secretAccessKey'] = document.getElementById('r2-secret-key').value;
      config['storage.r2.endpoint'] = document.getElementById('r2-endpoint').value;
    } else {
      config['storage.gdrive.folderId'] = document.getElementById('gdrive-folder').value;
    }

    // Save configuration first
    showStatus('Saving storage configuration...', 'info');

    const response = await fetch('/api/v1/setup', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + configPassword
      },
      body: JSON.stringify(config)
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
    const deleteResponse = await fetch(`/api/v1/storages/${testFileId}`, {
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

  /**
   * Update complete button state
   */
  function updateCompleteButton() {
    const completeBtn = document.getElementById('complete-setup-btn');
    if (!completeBtn) return;
    
    const sheetsInitialized = roleSheetInitialized && userSheetInitialized;
    completeBtn.disabled = !sheetsInitialized;
    
    if (sheetsInitialized) {
      completeBtn.textContent = 'Complete Setup & Go to Playground';
    }
  }

  /**
   * Show status message
   */
  function showStatus(message, type) {
    const statusDiv = document.getElementById('status-messages');
    if (statusDiv) {
      statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
    }
  }
});