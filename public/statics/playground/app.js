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

// Helper function to get master key from input
function getMasterKey() {
  const masterKeyInput = document.getElementById('master-key-input');
  return masterKeyInput ? masterKeyInput.value.trim() : '';
}

async function testEndpoint(method, url, body, responseId) {
  const responseEl = document.getElementById(responseId);
  responseEl.style.display = 'block';
  responseEl.textContent = 'Loading...';
  
  try {
    const options = {
      method: method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    };
    
    // Add master key header if provided
    const masterKey = getMasterKey();
    if (masterKey) {
      options.headers['X-Master-Key'] = masterKey;
    }
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    responseEl.textContent = `Status: ${response.status}\n\n${JSON.stringify(data, null, 2)}`;
  } catch (error) {
    responseEl.textContent = `Error: ${error.message}`;
  }
}

async function testSheetCreation(responseId) {
  await testEndpoint('POST', '/api/v1/sheets', { name: '_Role' }, responseId);
}

async function testUserSheetCreation(responseId) {
  await testEndpoint('POST', '/api/v1/sheets', { name: '_User' }, responseId);
}

async function testCustomSheetCreation(responseId) {
  const sheetNameInput = document.getElementById('sheet-name-input');
  const sheetName = sheetNameInput ? sheetNameInput.value.trim() : '';
  
  if (!sheetName) {
    alert('Please enter a sheet name');
    return;
  }
  
  await testEndpoint('POST', '/api/v1/sheets', { name: sheetName }, responseId);
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
    
    const headers = {
      'X-Requested-With': 'XMLHttpRequest'
    };
    
    // Add master key header if provided
    const masterKey = getMasterKey();
    if (masterKey) {
      headers['X-Master-Key'] = masterKey;
    }
    
    const response = await fetch('/api/v1/storages', {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: headers
    });
    
    const data = await response.json();
    responseEl.textContent = `Status: ${response.status}\n\n${JSON.stringify(data, null, 2)}`;
    
    // If upload was successful, store the file ID for delete testing
    if (data.fileId) {
      document.getElementById('file-id-input').value = data.fileId;
    }
  } catch (error) {
    responseEl.textContent = `Error: ${error.message}`;
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
    const headers = {
      'X-Requested-With': 'XMLHttpRequest'
    };
    
    // Add master key header if provided
    const masterKey = getMasterKey();
    if (masterKey) {
      headers['X-Master-Key'] = masterKey;
    }
    
    const response = await fetch(`/api/v1/storages/${fileId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: headers
    });
    
    const data = await response.json();
    responseEl.textContent = `Status: ${response.status}\n\n${JSON.stringify(data, null, 2)}`;
  } catch (error) {
    responseEl.textContent = `Error: ${error.message}`;
  }
}