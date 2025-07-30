// Configuration Management JavaScript

// Notification system
function showNotification(message, type = 'error', duration = 5000) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    ${message}
    <span class="close-btn" onclick="this.parentElement.remove()">×</span>
  `;
  
  document.body.appendChild(notification);
  
  // Trigger animation
  setTimeout(() => notification.classList.add('show'), 100);
  
  // Auto-remove after duration
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Check for sensitive changes
function getSensitiveChanges() {
  const sensitiveChanges = [];
  const sensitiveInputs = document.querySelectorAll('input[data-field-type="sensitive"]');
  
  sensitiveInputs.forEach(input => {
    if (!input.dataset.original && input.value !== '') {
      const key = input.name;
      const description = input.closest('tr').querySelector('.description-column').textContent;
      sensitiveChanges.push({ key, description });
    }
  });
  
  return sensitiveChanges;
}

// Show confirmation modal
function showConfirmationModal(sensitiveChanges, callback) {
  const modal = document.getElementById('confirmationModal');
  const changesList = document.getElementById('sensitiveChangesList');
  
  changesList.innerHTML = sensitiveChanges.map(change => 
    `<div>• ${change.description} (${change.key})</div>`
  ).join('');
  
  modal.classList.add('show');
  
  // Handle confirmation
  document.getElementById('confirmSubmit').onclick = () => {
    modal.classList.remove('show');
    callback(true);
  };
  
  document.getElementById('cancelSubmit').onclick = () => {
    modal.classList.remove('show');
    callback(false);
  };
  
  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
      callback(false);
    }
  };
}

// Track changes and update UI
function updateChangesCount() {
  const changedInputs = document.querySelectorAll('input[data-original]');
  const sensitiveInputs = document.querySelectorAll('input[data-field-type="sensitive"]');
  let changesCount = 0;
  
  // Check non-sensitive fields with data-original
  changedInputs.forEach(input => {
    const original = input.dataset.original;
    const current = input.type === 'checkbox' ? input.checked.toString() : input.value;
    
    if (current !== original) {
      changesCount++;
      input.closest('tr').classList.add('changed');
    } else {
      input.closest('tr').classList.remove('changed');
    }
  });
  
  // Check sensitive fields (any non-empty value means changed)
  sensitiveInputs.forEach(input => {
    if (!input.dataset.original) { // Only sensitive fields without data-original
      const current = input.value;
      if (current !== '') {
        changesCount++;
        input.closest('tr').classList.add('changed');
      } else {
        input.closest('tr').classList.remove('changed');
      }
    }
  });
  
  document.getElementById('changesCount').textContent = changesCount + ' changes';
}

// Reset individual field
function resetField(key) {
  const input = document.querySelector(`input[name="${key}"]`);
  if (input && input.dataset.original) { // Only reset non-sensitive fields with data-original
    const original = input.dataset.original;
    if (input.type === 'checkbox') {
      input.checked = original === 'true';
      // Update checkbox label
      const label = input.parentElement.querySelector('.checkbox-label');
      if (label) {
        label.textContent = input.checked ? 'Enabled' : 'Disabled';
      }
    } else {
      input.value = original;
    }
    updateChangesCount();
  }
}

// Reset all fields
function resetAllFields() {
  const inputs = document.querySelectorAll('input[data-original]');
  const sensitiveInputs = document.querySelectorAll('input[data-field-type="sensitive"]:not([data-original])');
  
  // Reset non-sensitive fields
  inputs.forEach(input => {
    const original = input.dataset.original;
    if (input.type === 'checkbox') {
      input.checked = original === 'true';
      // Update checkbox label
      const label = input.parentElement.querySelector('.checkbox-label');
      if (label) {
        label.textContent = input.checked ? 'Enabled' : 'Disabled';
      }
    } else {
      input.value = original;
    }
  });
  
  // Clear sensitive fields
  sensitiveInputs.forEach(input => {
    input.value = '';
  });
  
  updateChangesCount();
}

// Enhanced client-side validation with robust patterns
function validateField(key) {
  const input = document.querySelector(`input[name="${key}"]`);
  const statusElement = document.getElementById(`validation-${key}`);
  
  if (!input || !statusElement) return;
  
  const value = input.type === 'checkbox' ? input.checked.toString() : input.value;
  
  // Enhanced validation rules with regular expressions
  let isValid = true;
  let message = '';
  
  // Skip validation for empty sensitive fields (they keep current value)
  if (input.dataset.fieldType === 'sensitive' && value === '') {
    statusElement.className = 'validation-status success';
    statusElement.textContent = '✓ Will keep current';
    return;
  }
  
  if (key.includes('client_id') && value) {
    // Google OAuth client ID pattern: typically ends with .googleusercontent.com or .apps.googleusercontent.com
    const clientIdPattern = /^[0-9]+-[a-zA-Z0-9_]{32}\.apps\.googleusercontent\.com$|^[a-zA-Z0-9_-]{72}\.apps\.googleusercontent\.com$/;
    if (!clientIdPattern.test(value)) {
      isValid = false;
      message = 'Invalid client ID format (should be Google OAuth format)';
    }
  } else if (key.includes('domain') && value) {
    // Domain validation: proper FQDN format
    const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainPattern.test(value) || value.length > 253) {
      isValid = false;
      message = 'Invalid domain format';
    }
  } else if (key.includes('password') && value) {
    // Strong password requirements: min 8 chars, uppercase, lowercase, digit, special char
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (value.length < 8) {
      isValid = false;
      message = 'Password must be at least 8 characters';
    } else if (!passwordPattern.test(value)) {
      isValid = false;
      message = 'Password must include uppercase, lowercase, digit, and special character';
    }
  } else if (key.includes('client_secret') && value) {
    // Client secret validation: should be a long random string
    if (value.length < 24) {
      isValid = false;
      message = 'Client secret appears too short';
    } else if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      isValid = false;
      message = 'Client secret should contain only alphanumeric characters, hyphens, and underscores';
    }
  } else if (key.includes('sheetId') && value) {
    // Google Sheets ID validation
    const sheetIdPattern = /^[a-zA-Z0-9-_]{44}$/;
    if (!sheetIdPattern.test(value)) {
      isValid = false;
      message = 'Invalid Google Sheets ID format';
    }
  } else if (key.includes('rate_limit_delay') && value) {
    // Rate limit delay validation: should be a positive integer
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0 || !Number.isInteger(numValue) || value !== numValue.toString()) {
      isValid = false;
      message = 'Must be a positive integer (e.g., 100, 1000)';
    }
  } else if (key.includes('timeout') && value) {
    // Timeout validation: should be a positive integer
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0 || !Number.isInteger(numValue) || value !== numValue.toString()) {
      isValid = false;
      message = 'Must be a positive integer in milliseconds';
    }
  } else if (key.includes('port') && value) {
    // Port validation: should be between 1 and 65535
    const portValue = parseInt(value, 10);
    if (isNaN(portValue) || portValue < 1 || portValue > 65535 || value !== portValue.toString()) {
      isValid = false;
      message = 'Must be a valid port number (1-65535)';
    }
  } else if (key.includes('max_') && value) {
    // General max_ field validation: should be a positive integer
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0 || !Number.isInteger(numValue) || value !== numValue.toString()) {
      isValid = false;
      message = 'Must be a positive integer';
    }
  }
  
  statusElement.className = `validation-status ${isValid ? 'success' : 'error'}`;
  statusElement.textContent = isValid ? '✓ Valid' : `✗ ${message}`;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
  // Track changes on all inputs (both with and without data-original)
  const allInputs = document.querySelectorAll('input[name]');
  allInputs.forEach(input => {
    input.addEventListener('input', function() {
      updateChangesCount();
      // Auto-validate on input
      validateField(this.name);
    });
    input.addEventListener('change', function() {
      updateChangesCount();
      // Auto-validate on change
      validateField(this.name);
      
      // Update checkbox label
      if (this.type === 'checkbox') {
        const label = this.parentElement.querySelector('.checkbox-label');
        if (label) {
          label.textContent = this.checked ? 'Enabled' : 'Disabled';
        }
      }
    });
  });

  // Reset button handlers
  document.querySelectorAll('.reset-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const key = this.dataset.key;
      resetField(key);
    });
  });

  // Reset all button
  const resetAllBtn = document.getElementById('resetAll');
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to reset all changes?')) {
        resetAllFields();
      }
    });
  }

  // Form submission
  const configForm = document.getElementById('configForm');
  if (configForm) {
    configForm.addEventListener('submit', function(e) {
      e.preventDefault(); // Always prevent default submission
      
      // Check if there are any validation errors
      const errorElements = document.querySelectorAll('.validation-status.error');
      if (errorElements.length > 0) {
        showNotification('Please fix validation errors before saving.', 'error');
        return;
      }
      
      // Check for sensitive changes
      const sensitiveChanges = getSensitiveChanges();
      
      const proceedWithSubmission = () => {
        // Show loading state
        const submitBtn = document.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        
        // Submit the form
        e.target.submit();
      };
      
      if (sensitiveChanges.length > 0) {
        // Show confirmation modal for sensitive changes
        showConfirmationModal(sensitiveChanges, (confirmed) => {
          if (confirmed) {
            proceedWithSubmission();
          }
        });
      } else {
        // No sensitive changes, proceed normally
        proceedWithSubmission();
      }
    });
  }

  // Initial change count
  updateChangesCount();
  
  // Note: Initial validation results are not displayed on page load
  // Validation will show results only after user interaction
});