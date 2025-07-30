(function() {
  'use strict';
  
  // Private variables encapsulated within IIFE
  let selectedSheetId = null;

  async function loadSheets() {
    try {
      const authData = document.getElementById('auth-data');
      if (!authData || !authData.dataset || !authData.dataset.accessToken) {
        throw new Error('Authentication data not found');
      }
      
      const accessToken = authData.dataset.accessToken;
      
      // Use URL API for safe URL construction
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      const params = new URLSearchParams({
        q: 'mimeType="application/vnd.google-apps.spreadsheet"',
        fields: 'files(id,name,webViewLink)'
      });
      url.search = params.toString();
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': 'Bearer ' + accessToken
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sheets');
      }

      const data = await response.json();
      console.log('Google Drive API response:', data);
      displaySheets(data.files || []);
    } catch (error) {
      const sheetsListEl = document.getElementById('sheets-list');
      if (sheetsListEl) {
        // Use textContent to prevent XSS
        const errorDiv = document.createElement('div');
        errorDiv.className = 'loading';
        errorDiv.style.color = '#dc3545';
        errorDiv.textContent = 'Error loading sheets: ' + error.message;
        sheetsListEl.innerHTML = '';
        sheetsListEl.appendChild(errorDiv);
      }
    }
  }

  function displaySheets(sheets) {
    const listElement = document.getElementById('sheets-list');
    if (!listElement) {
      console.error('sheets-list element not found');
      return;
    }
    
    if (!sheets || sheets.length === 0) {
      // Use textContent to prevent XSS
      const noSheetsDiv = document.createElement('div');
      noSheetsDiv.className = 'loading';
      noSheetsDiv.textContent = 'No Google Sheets found. Please create one first.';
      listElement.innerHTML = '';
      listElement.appendChild(noSheetsDiv);
      return;
    }

    // Clear the list
    listElement.innerHTML = '';
    
    // Create sheet items using DOM methods
    sheets.forEach(sheet => {
      const sheetItem = document.createElement('div');
      sheetItem.className = 'sheet-item';
      sheetItem.dataset.sheetId = sheet.id;
      
      const sheetName = document.createElement('div');
      sheetName.className = 'sheet-name';
      sheetName.textContent = sheet.name; // textContent prevents XSS
      
      const sheetUrl = document.createElement('div');
      sheetUrl.className = 'sheet-url';
      sheetUrl.textContent = sheet.webViewLink; // textContent prevents XSS
      
      sheetItem.appendChild(sheetName);
      sheetItem.appendChild(sheetUrl);
      
      // Add click event listener
      sheetItem.addEventListener('click', function() {
        selectSheet(sheet.id, this);
      });
      
      listElement.appendChild(sheetItem);
    });
  }

  function selectSheet(sheetId, element) {
    // Remove previous selection
    document.querySelectorAll('.sheet-item').forEach(item => {
      item.classList.remove('selected');
    });
    
    // Add selection to clicked item
    element.classList.add('selected');
    selectedSheetId = sheetId;
    
    // Enable select button with null check
    const selectBtn = document.getElementById('select-btn');
    if (selectBtn) {
      selectBtn.disabled = false;
    }
  }

  // Initialize event listeners
  function initEventListeners() {
    const selectBtn = document.getElementById('select-btn');
    if (selectBtn) {
      selectBtn.addEventListener('click', async function() {
        if (!selectedSheetId) return;
        
        try {
          const authData = document.getElementById('auth-data');
          if (!authData || !authData.dataset) {
            throw new Error('Authentication data not found');
          }
          
          const configPassword = authData.dataset.configPassword;
          const accessToken = authData.dataset.accessToken;
          
          if (!configPassword || !accessToken) {
            throw new Error('Required authentication data missing');
          }
          
          // Save selected sheet ID to backend with authentication
          const response = await fetch('/api/v1/setup', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + configPassword
            },
            body: JSON.stringify({ 'google.sheetId': selectedSheetId })
          });

          if (!response.ok) {
            throw new Error('Failed to save selected sheet');
          }

          // Use URL API for safe URL construction
          const redirectUrl = new URL('/sheet/initialize', window.location.origin);
          redirectUrl.searchParams.set('accessToken', accessToken);
          window.location.href = redirectUrl.toString();
        } catch (error) {
          alert('Error selecting sheet: ' + error.message);
        }
      });
    }

    // Add event listeners for cancel buttons with null checks
    const cancelAuthBtn = document.getElementById('cancel-auth-btn');
    if (cancelAuthBtn) {
      cancelAuthBtn.addEventListener('click', function() {
        window.close();
      });
    }

    const cancelSuccessBtn = document.getElementById('cancel-success-btn');
    if (cancelSuccessBtn) {
      cancelSuccessBtn.addEventListener('click', function() {
        window.close();
      });
    }
  }

  // Load sheets on page load
  document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    loadSheets();
  });

})();