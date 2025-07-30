let selectedSheetId = null;

async function loadSheets() {
  try {
    const authData = document.getElementById('auth-data');
    const accessToken = authData.dataset.accessToken;
    
    const response = await fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent('mimeType="application/vnd.google-apps.spreadsheet"') + '&fields=files(id,name,webViewLink)', {
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
    document.getElementById('sheets-list').innerHTML = 
      '<div class="loading" style="color: #dc3545;">Error loading sheets: ' + error.message + '</div>';
  }
}

function displaySheets(sheets) {
  const listElement = document.getElementById('sheets-list');
  
  if (!sheets || sheets.length === 0) {
    listElement.innerHTML = '<div class="loading">No Google Sheets found. Please create one first.</div>';
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
    sheetName.textContent = sheet.name;
    
    const sheetUrl = document.createElement('div');
    sheetUrl.className = 'sheet-url';
    sheetUrl.textContent = sheet.webViewLink;
    
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
  
  // Enable select button
  document.getElementById('select-btn').disabled = false;
}

document.getElementById('select-btn').addEventListener('click', async function() {
  if (!selectedSheetId) return;
  
  try {
    const authData = document.getElementById('auth-data');
    const configPassword = authData.dataset.configPassword;
    const accessToken = authData.dataset.accessToken;
    
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

    // Redirect to sheet initialization page
    window.location.href = '/sheet/initialize?accessToken=' + encodeURIComponent(accessToken);
  } catch (error) {
    alert('Error selecting sheet: ' + error.message);
  }
});

// Add event listeners for cancel buttons
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

// Load sheets on page load
document.addEventListener('DOMContentLoaded', function() {
  loadSheets();
});