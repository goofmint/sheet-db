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
      textElement.querySelector('.config-text-value').textContent = config.value;
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
});