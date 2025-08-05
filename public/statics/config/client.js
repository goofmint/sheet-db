// Client-side JavaScript for configuration management
let configPassword = null;
let modalMode = 'add'; // 'add' or 'edit'
let editingConfig = null; // Stores the config being edited

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
  console.log('updateConfigTable called with configs:', configs.length); // Debug log
  const tbody = document.querySelector('#config-table tbody');
  const rowTemplate = document.querySelector('#config-row-template');
  
  // Clear existing rows
  tbody.innerHTML = '';
  
  configs.forEach(config => {
    console.log('Processing config:', config.key); // Debug log
    const row = rowTemplate.content.cloneNode(true);
    
    // Set key
    row.querySelector('.config-key').textContent = config.key;
    
    // Set value
    const valueCell = row.querySelector('.config-value');
    if (config.type === 'boolean') {
      const boolTemplate = document.querySelector('#config-value-boolean-template');
      const boolElement = boolTemplate.content.cloneNode(true);
      const checkbox = boolElement.querySelector('.config-boolean-value');
      checkbox.checked = config.value === true || config.value === 'true';
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
    
    // Add edit button to actions cell
    const actionsCell = row.querySelector('.config-actions');
    console.log('actionsCell:', actionsCell); // Debug log
    if (actionsCell) {
      // Clear any existing content in actions cell
      actionsCell.innerHTML = '';
      
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-edit';
      editBtn.textContent = 'Edit';
      editBtn.onclick = () => showEditConfigModal(config);
      actionsCell.appendChild(editBtn);
    } else {
      console.error('actionsCell not found for config:', config.key);
    }
    
    tbody.appendChild(row);
  });
}

function showErrorMessage(message) {
  const tbody = document.querySelector('#config-table tbody');
  tbody.innerHTML = `<tr><td colspan="4" class="error-message">${message}</td></tr>`;
}

// Modal functions
function showAddConfigModal() {
  modalMode = 'add';
  editingConfig = null;
  
  // Update modal for add mode
  document.querySelector('.modal-header h2').textContent = 'Add Configuration';
  document.querySelector('#add-config-form button[type="submit"]').textContent = 'Add';
  document.getElementById('config-key').disabled = false;
  
  // Reset form
  document.getElementById('add-config-form').reset();
  document.getElementById('modal-error').style.display = 'none';
  
  document.getElementById('add-config-modal').style.display = 'block';
}

function showEditConfigModal(config) {
  modalMode = 'edit';
  editingConfig = config;
  
  // Update modal for edit mode
  document.querySelector('.modal-header h2').textContent = 'Edit Configuration';
  document.querySelector('#add-config-form button[type="submit"]').textContent = 'Update';
  document.getElementById('config-key').readOnly = true;
  
  // Fill form with current values
  document.getElementById('config-key').value = config.key;
  document.getElementById('config-type').value = config.type;
  document.getElementById('config-description').value = config.description || '';
  document.getElementById('config-validation').value = config.validation || '';
  
  // Set value based on type
  let displayValue = config.value;
  if (config.type === 'json' && typeof config.value === 'object') {
    displayValue = JSON.stringify(config.value, null, 2);
  }
  document.getElementById('config-value').value = displayValue;
  
  document.getElementById('modal-error').style.display = 'none';
  document.getElementById('add-config-modal').style.display = 'block';
}

function hideAddConfigModal() {
  document.getElementById('add-config-modal').style.display = 'none';
  document.getElementById('add-config-form').reset();
  document.getElementById('modal-error').style.display = 'none';
  modalMode = 'add';
  editingConfig = null;
  
  // Reset to add mode
  document.getElementById('config-key').disabled = false;
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

// Validate value based on validation rules
function validateValue(value, validationRules) {
  if (!validationRules) {
    return { valid: true };
  }
  
  let rules;
  try {
    rules = typeof validationRules === 'string' ? JSON.parse(validationRules) : validationRules;
  } catch (error) {
    return { valid: false, message: 'Invalid validation rules JSON format' };
  }
  
  // Check required
  if (rules.required === true && (!value || value.trim() === '')) {
    return { valid: false, message: 'This field is required' };
  }
  
  // Allow empty values if not required
  if (!rules.required && (!value || value.trim() === '')) {
    return { valid: true };
  }
  
  const trimmedValue = value.trim();
  
  // Check minLength
  if (rules.minLength && trimmedValue.length < rules.minLength) {
    return { valid: false, message: `Minimum length is ${rules.minLength} characters` };
  }
  
  // Check maxLength
  if (rules.maxLength && trimmedValue.length > rules.maxLength) {
    return { valid: false, message: `Maximum length is ${rules.maxLength} characters` };
  }
  
  // Check pattern (regex)
  if (rules.pattern && !new RegExp(rules.pattern).test(trimmedValue)) {
    return { valid: false, message: rules.patternMessage || 'Value does not match required pattern' };
  }
  
  return { valid: true };
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

// Handle add/edit config form submission
async function handleAddConfig(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const rawKey = formData.get('key');
  const rawValue = formData.get('value');
  const type = formData.get('type');
  const validationRules = formData.get('validation');
  
  // Validate key (always required)
  if (!rawKey || rawKey.trim() === '') {
    showErrorInModal('Configuration key is required.');
    return;
  }
  
  // Validate value based on validation rules
  const validation = validateValue(rawValue, validationRules);
  if (!validation.valid) {
    showErrorInModal(validation.message);
    return;
  }
  
  try {
    let value = convertValueByType(rawValue, type);
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    
    let response;
    if (modalMode === 'add') {
      // Add new config
      submitBtn.textContent = 'Adding...';
      
      const configData = {
        key: rawKey.trim(),
        value: value,
        type: type,
        description: formData.get('description') || '',
        validation: validationRules || null
      };
      
      response = await fetch('/api/v1/configs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
      });
    } else {
      // Update existing config
      submitBtn.textContent = 'Updating...';
      
      // Check if value has changed
      let currentValue = editingConfig.value;
      if (editingConfig.type === 'json' && typeof currentValue === 'object') {
        currentValue = JSON.stringify(currentValue);
      }
      let newValue = value;
      if (type === 'json' && typeof newValue === 'object') {
        newValue = JSON.stringify(newValue);
      }
      
      if (String(currentValue) === String(newValue) && 
          editingConfig.description === (formData.get('description') || '')) {
        hideAddConfigModal();
        showSuccessMessage('No changes to update.');
        return;
      }
      
      const updateData = {
        value: value,
        description: formData.get('description') || '',
        validation: validationRules || null
      };
      
      response = await fetch(`/api/v1/configs/${encodeURIComponent(editingConfig.key)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }
    
    // Success
    hideAddConfigModal();
    showSuccessMessage(modalMode === 'add' ? 'Configuration added successfully.' : 'Configuration updated successfully.');
    
    // Reload configs
    await loadConfigsWithPassword(configPassword);
    
  } catch (error) {
    console.error(`Failed to ${modalMode} config:`, error);
    showErrorInModal(error.message);
  } finally {
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = modalMode === 'add' ? 'Add' : 'Update';
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
  
  // Close modal on Escape key (but not during IME composition)
  let isComposing = false;
  
  document.addEventListener('compositionstart', function() {
    isComposing = true;
  });
  
  document.addEventListener('compositionend', function() {
    isComposing = false;
  });
  
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && !isComposing) {
      const modal = document.getElementById('add-config-modal');
      if (modal && modal.style.display === 'block') {
        hideAddConfigModal();
      }
    }
  });
});