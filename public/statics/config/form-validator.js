/**
 * Frontend Configuration Validation System
 * Provides real-time validation for configuration form fields
 */

class ConfigFormValidator {
  constructor(validationRules) {
    this.rules = validationRules;
    this.setupEventListeners();
  }

  // Setup event listeners for form validation
  setupEventListeners() {
    const configInputs = document.querySelectorAll('.config-input');
    
    configInputs.forEach(input => {
      // Real-time validation on input
      input.addEventListener('input', (e) => {
        this.validateField(e.target);
      });
      
      // Clear error on focus
      input.addEventListener('focus', (e) => {
        this.clearFieldError(e.target);
      });
      
      // Validate on blur
      input.addEventListener('blur', (e) => {
        this.validateField(e.target);
      });
    });
  }

  // Validate a single field
  validateField(input) {
    const key = input.name;
    const value = input.value;
    const allConfig = this.getAllConfigValues();

    // Validate the field
    const result = this.validateSingleField(key, value, allConfig);
    
    if (result.valid) {
      this.showFieldSuccess(input);
    } else {
      this.showFieldError(input, result.error);
    }

    return result.valid;
  }

  // Validate all fields
  validateAllFields() {
    const allConfig = this.getAllConfigValues();
    let isValid = true;
    const errors = {};

    for (const [key, value] of Object.entries(allConfig)) {
      const result = this.validateSingleField(key, value, allConfig);
      if (!result.valid) {
        isValid = false;
        errors[key] = result.error;
        
        const input = document.querySelector(`input[name="${key}"]`);
        if (input) {
          this.showFieldError(input, result.error);
        }
      }
    }

    // Show/hide error summary
    if (!isValid) {
      this.showErrorSummary(errors);
    } else {
      this.hideErrorSummary();
    }

    return isValid;
  }

  // Show field error
  showFieldError(input, message) {
    input.classList.add('error');
    input.classList.remove('success');
    
    // Remove existing error message
    const existingError = input.parentNode.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }

    // Add error message
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    input.parentNode.appendChild(errorElement);
  }

  // Clear field error
  clearFieldError(input) {
    input.classList.remove('error', 'success');
    const errorMessage = input.parentNode.querySelector('.error-message');
    if (errorMessage) {
      errorMessage.remove();
    }
  }

  // Show field success
  showFieldSuccess(input) {
    input.classList.remove('error');
    input.classList.add('success');
    
    const errorMessage = input.parentNode.querySelector('.error-message');
    if (errorMessage) {
      errorMessage.remove();
    }
  }

  // Show error summary
  showErrorSummary(errors) {
    const errorCount = Object.keys(errors).length;
    let summaryElement = document.getElementById('error-summary');
    
    if (!summaryElement) {
      summaryElement = this.createErrorSummary();
    }
    
    summaryElement.innerHTML = `
      <div class="error-header">
        <span class="icon">⚠️</span>
        <strong>${errorCount}件のエラーがあります</strong>
      </div>
      <ul class="error-list">
        ${Object.entries(errors).map(([key, message]) => 
          `<li><strong>${key}:</strong> ${message}</li>`
        ).join('')}
      </ul>
    `;
    
    summaryElement.style.display = 'block';
    summaryElement.scrollIntoView({ behavior: 'smooth' });
  }

  // Hide error summary
  hideErrorSummary() {
    const summaryElement = document.getElementById('error-summary');
    if (summaryElement) {
      summaryElement.style.display = 'none';
    }
  }

  // Create error summary element
  createErrorSummary() {
    const summaryElement = document.createElement('div');
    summaryElement.id = 'error-summary';
    summaryElement.className = 'error-summary';
    
    const form = document.getElementById('configForm');
    form.insertBefore(summaryElement, form.firstChild);
    
    return summaryElement;
  }

  // Get all configuration values
  getAllConfigValues() {
    const inputs = document.querySelectorAll('.config-input');
    const config = {};
    
    inputs.forEach(input => {
      config[input.name] = input.value;
    });
    
    return config;
  }

  // Validate single field (frontend version)
  validateSingleField(key, value, allConfig) {
    const rule = this.rules[key];
    if (!rule) return { valid: true };

    // Required validation
    if (rule.required && (!value || value.trim() === '')) {
      return { valid: false, error: `${key}は必須項目です` };
    }

    // If empty and not required, skip other validations
    if (!value || value.trim() === '') {
      return { valid: true };
    }

    // Type-specific validation
    if (rule.type === 'number') {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || !isFinite(numValue)) {
        return { valid: false, error: rule.errorMessage || '有効な数値を入力してください' };
      }
      
      if (rule.min !== undefined && numValue < rule.min) {
        return { valid: false, error: rule.errorMessage };
      }
      
      if (rule.max !== undefined && numValue > rule.max) {
        return { valid: false, error: rule.errorMessage };
      }
    }

    if (rule.type === 'boolean') {
      if (value !== 'true' && value !== 'false') {
        return { valid: false, error: rule.errorMessage || 'trueまたはfalseを入力してください' };
      }
    }

    // Length validation
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return { valid: false, error: rule.errorMessage };
    }
    
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return { valid: false, error: rule.errorMessage };
    }

    // Pattern validation
    if (rule.pattern && value) {
      try {
        const regex = new RegExp(rule.pattern);
        if (!regex.test(value)) {
          return { valid: false, error: rule.errorMessage };
        }
      } catch (error) {
        console.warn('Invalid regex pattern:', rule.pattern);
      }
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
      return { valid: false, error: rule.errorMessage };
    }

    // Dependency validation
    const dependencyErrors = this.validateFieldDependencies(key, value, allConfig);
    if (dependencyErrors.length > 0) {
      return { valid: false, error: dependencyErrors[0] };
    }

    return { valid: true };
  }

  // Field dependency validation
  validateFieldDependencies(key, value, config) {
    const errors = [];
    
    // Storage type dependencies
    if (key === 'storage.r2.bucket' || key === 'storage.r2.access_key_id' || 
        key === 'storage.r2.secret_access_key' || key === 'storage.r2.endpoint') {
      if (config['storage.type'] !== 'r2' && value.trim() !== '') {
        errors.push('R2設定はストレージタイプがr2の場合のみ有効です');
      }
    }
    
    if (key === 'storage.gdrive.folder_id') {
      if (config['storage.type'] !== 'gdrive' && value.trim() !== '') {
        errors.push('Google Drive設定はストレージタイプがgdriveの場合のみ有効です');
      }
    }
    
    return errors;
  }
}

// Export for use in other scripts
window.ConfigFormValidator = ConfigFormValidator;