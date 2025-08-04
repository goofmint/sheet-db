// Client-side JavaScript for configuration management
let configPassword = null;

async function loadConfigsWithPassword(password) {
  try {
    const response = await fetch('/api/v1/configs?limit=100&sort=key&order=asc', {
      headers: {
        'Authorization': `Bearer ${password}`
      }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid password');
      }
      throw new Error(`HTTP ${response.status}`);
    }

    // 204 No-Content -> empty list
    const apiResult = response.status === 204 
      ? { data: { configs: [] } } 
      : await response.json();
    const configs = apiResult.data.configs;
    
    configPassword = password;
    updateConfigTable(configs);
    return true;
  } catch (error) {
    console.error('Failed to load configs:', error);
    if (error.message === 'Invalid password') {
      showErrorMessage('Invalid password. Please try again.');
    } else {
      showErrorMessage('Failed to load configuration data');
    }
    return false;
  }
}

function handlePasswordSubmit(event) {
  event.preventDefault();
  const password = event.target.password.value;
  const errorDiv = document.getElementById('error');
  
  if (!password) {
    errorDiv.textContent = 'Password is required';
    errorDiv.style.display = 'block';
    return;
  }
  
  errorDiv.style.display = 'none';
  
  loadConfigsWithPassword(password).then(success => {
    if (success) {
      // Hide auth form and show config container
      document.getElementById('auth-form').style.display = 'none';
      document.getElementById('config-container').style.display = 'block';
    } else {
      errorDiv.textContent = 'Invalid password';
      errorDiv.style.display = 'block';
    }
  });
}

function handleLogout() {
  // Reset password and show auth form
  configPassword = null;
  document.getElementById('config-container').style.display = 'none';
  document.getElementById('auth-form').style.display = 'block';
  document.getElementById('password-input').value = '';
  document.getElementById('error').style.display = 'none';
}

function updateConfigTable(configs) {
  const tbody = document.querySelector('#config-table tbody');
  const rowTemplate = document.querySelector('#config-row-template');
  
  // Clear existing rows
  tbody.innerHTML = '';
  
  configs.forEach(config => {
    const row = rowTemplate.content.cloneNode(true);
    
    // Set key
    row.querySelector('.config-key').textContent = config.key;
    
    // Set value
    const valueCell = row.querySelector('.config-value');
    if (config.type === 'boolean') {
      const boolTemplate = document.querySelector('#config-value-boolean-template');
      const boolElement = boolTemplate.content.cloneNode(true);
      const checkbox = boolElement.querySelector('.config-boolean-value');
      checkbox.checked = config.value === 'true';
      valueCell.appendChild(boolElement);
    } else if (config.key.includes('secret') || config.key.includes('password')) {
      const secretTemplate = document.querySelector('#config-value-secret-template');
      valueCell.appendChild(secretTemplate.content.cloneNode(true));
    } else {
      const textTemplate = document.querySelector('#config-value-text-template');
      const textElement = textTemplate.content.cloneNode(true);
      
      // Format value based on type
      let displayValue = config.value;
      if (config.type === 'json') {
        // For JSON type, format the value nicely
        try {
          const parsed = typeof config.value === 'string' ? JSON.parse(config.value) : config.value;
          displayValue = JSON.stringify(parsed, null, 2);
        } catch {
          // If parsing fails, show as-is
          displayValue = config.value;
        }
      }
      
      textElement.querySelector('.config-text-value').textContent = displayValue;
      valueCell.appendChild(textElement);
    }
    
    // Set description
    row.querySelector('.config-description').textContent = config.description || '';
    
    tbody.appendChild(row);
  });
}

function showErrorMessage(message) {
  const tbody = document.querySelector('#config-table tbody');
  tbody.innerHTML = `<tr><td colspan="3" class="error-message">${message}</td></tr>`;
}

// Modal functions
function showAddConfigModal() {
  document.getElementById('add-config-modal').style.display = 'block';
}

function hideAddConfigModal() {
  document.getElementById('add-config-modal').style.display = 'none';
  document.getElementById('add-config-form').reset();
  document.getElementById('modal-error').style.display = 'none';
}

// Show error in modal
function showErrorInModal(message) {
  const errorDiv = document.getElementById('modal-error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

// Show success message
function showSuccessMessage(message) {
  // Create a temporary success message element
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.textContent = message;
  
  // Insert it before the config table
  const configTable = document.querySelector('.config-table');
  configTable.parentNode.insertBefore(successDiv, configTable);
  
  // Remove after 3 seconds
  setTimeout(() => {
    successDiv.remove();
  }, 3000);
}

// Convert value by type
function convertValueByType(value, type) {
  const trimmedValue = value.trim();
  
  switch (type) {
    case 'boolean':
      const lowerValue = trimmedValue.toLowerCase();
      if (lowerValue === 'true' || lowerValue === '1') {
        return true;
      } else if (lowerValue === 'false' || lowerValue === '0') {
        return false;
      } else {
        throw new Error('Invalid boolean value. Use true/false or 1/0.');
      }
    case 'number':
      // Validate that the entire string is a valid number
      if (!/^-?\d+(\.\d+)?$/.test(trimmedValue)) {
        throw new Error('Invalid number format. Only integers and decimals are allowed.');
      }
      const num = parseFloat(trimmedValue);
      if (isNaN(num)) throw new Error('Invalid number value.');
      return num;
    case 'json':
      try {
        const parsed = JSON.parse(trimmedValue);
        return parsed; // Return as parsed object
      } catch {
        throw new Error('Invalid JSON format.');
      }
    default:
      return trimmedValue;
  }
}

// Handle add config form submission
async function handleAddConfig(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const rawKey = formData.get('key');
  const rawValue = formData.get('value');
  const type = formData.get('type');
  
  // Validation
  if (!rawKey || rawKey.trim() === '' || !rawValue || rawValue === '') {
    showErrorInModal('Key and value are required.');
    return;
  }
  
  try {
    const configData = {
      key: rawKey.trim(),
      value: convertValueByType(rawValue, type),
      type: type,
      description: formData.get('description') || ''
    };
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    
    const response = await fetch('/api/v1/configs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${configPassword}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(configData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }
    
    // Success
    hideAddConfigModal();
    showSuccessMessage('Configuration added successfully.');
    
    // Reload configs
    await loadConfigsWithPassword(configPassword);
    
  } catch (error) {
    console.error('Failed to add config:', error);
    showErrorInModal(error.message);
  } finally {
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add';
  }
}

// Initialize page when DOM loads
document.addEventListener('DOMContentLoaded', function() {
  const passwordForm = document.getElementById('password-form');
  const logoutBtn = document.getElementById('logout-btn');
  
  if (passwordForm) {
    passwordForm.addEventListener('submit', handlePasswordSubmit);
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // Add config button and modal
  const addConfigBtn = document.getElementById('add-config-btn');
  if (addConfigBtn) {
    addConfigBtn.addEventListener('click', showAddConfigModal);
  }
  
  // Modal close button
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const addConfigForm = document.getElementById('add-config-form');
  
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', hideAddConfigModal);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', hideAddConfigModal);
  }
  
  if (addConfigForm) {
    addConfigForm.addEventListener('submit', handleAddConfig);
  }
  
  // Close modal on outside click
  const modal = document.getElementById('add-config-modal');
  if (modal) {
    window.addEventListener('click', function(event) {
      if (event.target === modal) {
        hideAddConfigModal();
      }
    });
  }
});