// Track changes and update UI
function updateChangesCount() {
  const changedInputs = document.querySelectorAll('input[data-original]');
  let changesCount = 0;
  
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
  
  document.getElementById('changesCount').textContent = changesCount + ' changes';
}

// Reset individual field
function resetField(key) {
  const input = document.querySelector(`input[name="${key}"]`);
  if (input) {
    const original = input.dataset.original;
    if (input.type === 'checkbox') {
      input.checked = original === 'true';
    } else {
      input.value = original;
    }
    updateChangesCount();
  }
}

// Reset all fields
function resetAllFields() {
  const inputs = document.querySelectorAll('input[data-original]');
  inputs.forEach(input => {
    const original = input.dataset.original;
    if (input.type === 'checkbox') {
      input.checked = original === 'true';
    } else {
      input.value = original;
    }
  });
  updateChangesCount();
}

// Validation rules (fetched from server)
let validationRules = {};
let formValidator = null;

// Fetch validation rules from server
async function loadValidationRules() {
  try {
    const response = await fetch('/api/v1/config/validation-rules');
    if (response.ok) {
      validationRules = await response.json();
      formValidator = new ConfigFormValidator(validationRules);
    }
  } catch (error) {
    console.warn('Failed to load validation rules:', error);
  }
}

// Validate field (enhanced)
function validateField(key) {
  if (formValidator) {
    const input = document.querySelector(`input[name="${key}"]`);
    if (input) {
      return formValidator.validateField(input);
    }
  }
  return true;
}

// Format the form data for API submission
async function submitForm(e) {
  e.preventDefault();
  
  // Validate all fields before submission
  if (formValidator && !formValidator.validateAllFields()) {
    showNotification('設定にエラーがあります。修正してから保存してください。', 'error');
    return;
  }
  
  // Show loading state
  const submitBtn = document.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';
  
  // Collect form data as flat key/value pairs
  const formData = new FormData(e.target);
  const config = {};
  
  // Convert FormData to simple key/value object
  for (const [key, value] of formData.entries()) {
    const input = e.target.querySelector(`input[name="${key}"]`);
    if (input && input.type === 'checkbox') {
      // For checkboxes, convert "on" to true
      config[key] = true;
    } else {
      config[key] = value;
    }
  }
  
  // Handle all unchecked checkboxes
  const checkboxes = e.target.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    if (!formData.has(checkbox.name)) {
      config[checkbox.name] = false;
    }
  });
  
  try {
    // Get config password for Authorization header
    const configPassword = formData.get('app.config_password') || 
                           document.querySelector('input[name="app.config_password"]')?.value;
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add Authorization header if config password is available
    if (configPassword) {
      headers['Authorization'] = `Bearer ${configPassword}`;
    }
    
    const response = await fetch('/api/v1/setup', {
      method: 'POST',
      headers,
      body: JSON.stringify(config),
    });
    
    if (response.ok) {
      // Reset the original values after successful save
      const inputs = document.querySelectorAll('input[data-original]');
      inputs.forEach(input => {
        const current = input.type === 'checkbox' ? input.checked.toString() : input.value;
        input.dataset.original = current;
      });
      updateChangesCount();
      
      // Show success notification
      showNotification('Configuration saved successfully!', 'success');
      
      // Update button state
      submitBtn.textContent = 'Saved!';
      setTimeout(() => {
        submitBtn.textContent = 'Save All';
        submitBtn.disabled = false;
      }, 2000);
    } else {
      const error = await response.json();
      
      // Handle validation errors from server
      if (error.error && error.error.code === 'VALIDATION_ERROR' && error.error.details) {
        showValidationErrors(error.error.details);
        showNotification('設定の検証に失敗しました。エラーを修正してください。', 'error');
      } else {
        showNotification('Failed to save configuration: ' + (error.message || 'Unknown error'), 'error');
      }
      
      submitBtn.textContent = 'Save All';
      submitBtn.disabled = false;
    }
  } catch (error) {
    showNotification('Failed to save configuration: ' + error.message, 'error');
    submitBtn.textContent = 'Save All';
    submitBtn.disabled = false;
  }
}

// Show server validation errors
function showValidationErrors(errors) {
  Object.entries(errors).forEach(([key, message]) => {
    const input = document.querySelector(`input[name="${key}"]`);
    if (input && formValidator) {
      formValidator.showFieldError(input, message);
    }
  });
  
  if (formValidator) {
    formValidator.showErrorSummary(errors);
  }
}

// Show notification function
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Show with animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  // Auto-hide after 4 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 4000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', async function() {
  // Load validation rules first
  await loadValidationRules();
  
  // Track changes on all inputs and add auto-validation
  const inputs = document.querySelectorAll('input[data-original]');
  inputs.forEach(input => {
    input.addEventListener('input', updateChangesCount);
    input.addEventListener('change', updateChangesCount);
    
    // Add validation class for styling
    input.classList.add('config-input');
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
    configForm.addEventListener('submit', submitForm);
  }

  // Initial change count
  updateChangesCount();
});