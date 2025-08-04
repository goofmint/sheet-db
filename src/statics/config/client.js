// Client-side JavaScript for configuration management
async function loadConfigs() {
  try {
    const response = await fetch('/api/v1/configs?limit=100&sort=key&order=asc');

    if (!response.ok) {
      // Surface the HTTP error to the caller/UI
      throw new Error(`HTTP ${response.status}`);
    }

    // 204 No-Content -> empty list
    const apiResult = response.status === 204 
      ? { data: { configs: [] } } 
      : await response.json();
    const configs = apiResult.data.configs;
    
    updateConfigTable(configs);
  } catch (error) {
    console.error('Failed to load configs:', error);
    showErrorMessage('Failed to load configuration data');
  }
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

// Load configurations when the page loads
document.addEventListener('DOMContentLoaded', loadConfigs);