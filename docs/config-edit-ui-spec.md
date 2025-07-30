# Configuration Edit UI/UX Specification

This document provides detailed UI/UX specifications for the configuration editing functionality.

## Design Principles

### Security First
- Sensitive data remains masked until explicitly revealed
- Clear visual indicators for sensitive operations
- Confirmation dialogs for destructive changes
- Session timeout warnings

### Progressive Enhancement
- Start with view-only mode
- Edit mode is opt-in via explicit user action
- Graceful degradation without JavaScript
- Mobile-responsive design

### User Experience
- Intuitive editing workflows
- Real-time validation feedback
- Clear error messages with recovery suggestions
- Undo/reset capabilities

## Visual Design System

### Color Palette
```css
:root {
  /* Status Colors */
  --success-color: #28a745;
  --warning-color: #ffc107;
  --danger-color: #dc3545;
  --info-color: #17a2b8;
  
  /* UI Colors */
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --background-color: #f8f9fa;
  --card-background: #ffffff;
  --border-color: #dee2e6;
  
  /* Text Colors */
  --text-primary: #495057;
  --text-secondary: #6c757d;
  --text-muted: #adb5bd;
}
```

### Typography
```css
.config-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.config-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.config-key {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  font-weight: 500;
}
```

## Layout Structure

### Page Layout
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Configuration Management - SheetDB</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <!-- Navigation Bar -->
  <nav class="navbar">
    <div class="nav-left">
      <a href="/playground" class="back-link">← Back to Playground</a>
    </div>
    <div class="nav-right">
      <button id="editToggle" class="btn btn-primary">Edit Configuration</button>
      <a href="/config/logout" class="btn btn-secondary">Logout</a>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="container">
    <!-- Header Section -->
    <header class="page-header">
      <h1>⚙️ Configuration Management</h1>
      <p class="description">Manage your application configuration settings</p>
      
      <!-- Mode Indicator -->
      <div class="mode-indicator">
        <span class="mode-badge" id="modeIndicator">View Mode</span>
        <span class="session-timer" id="sessionTimer">Session: 1h 59m</span>
      </div>
    </header>

    <!-- Configuration Table -->
    <section class="config-section">
      <div class="config-controls" id="configControls" style="display: none;">
        <div class="control-group">
          <button class="btn btn-success" id="saveAll">Save All Changes</button>
          <button class="btn btn-secondary" id="cancelEdit">Cancel</button>
          <span class="changes-indicator" id="changesCount">0 changes</span>
        </div>
        <div class="filter-group">
          <select id="categoryFilter" class="form-select">
            <option value="">All Categories</option>
            <option value="google">Google Services</option>
            <option value="auth0">Auth0</option>
            <option value="storage">Storage</option>
            <option value="app">Application</option>
          </select>
          <input type="search" id="searchFilter" placeholder="Search configurations..." class="form-input">
        </div>
      </div>

      <div class="config-table-container">
        <table class="config-table" id="configTable">
          <!-- Table content will be generated dynamically -->
        </table>
      </div>
    </section>
  </main>

  <!-- Modals and Overlays -->
  <div id="confirmModal" class="modal">
    <div class="modal-content">
      <h3>Confirm Sensitive Change</h3>
      <p>You are about to modify a sensitive configuration value. This action may affect system security or functionality.</p>
      <div class="modal-actions">
        <button class="btn btn-danger" id="confirmSensitive">Yes, Continue</button>
        <button class="btn btn-secondary" id="cancelSensitive">Cancel</button>
      </div>
    </div>
  </div>

  <div id="validationTooltip" class="tooltip"></div>
</body>
</html>
```

## Component Specifications

### 1. Mode Toggle Button

#### View Mode
```html
<button id="editToggle" class="btn btn-primary" type="button">
  <i class="icon-edit">✏️</i>
  Edit Configuration
</button>
```

#### Edit Mode
```html
<button id="editToggle" class="btn btn-outline-primary" type="button">
  <i class="icon-view">👁️</i>
  Exit Edit Mode
</button>
```

### 2. Configuration Table

#### View Mode Row
```html
<tr class="config-row" data-key="google.client_id" data-category="google">
  <td class="key-column">
    <code>google.client_id</code>
    <span class="category-badge category-google">Google</span>
  </td>
  <td class="value-column">
    <div class="value-display">
      <input type="text" value="123456789-abcdef.apps.googleusercontent.com" readonly>
    </div>
  </td>
  <td class="description-column">
    <span class="description-text">Google OAuth2 Client ID</span>
  </td>
</tr>
```

#### Edit Mode Row (Normal Field)
```html
<tr class="config-row edit-mode" data-key="google.client_id" data-category="google">
  <td class="key-column">
    <code>google.client_id</code>
    <span class="category-badge category-google">Google</span>
    <span class="required-indicator" title="Required field">*</span>
  </td>
  <td class="value-column">
    <div class="value-input-group">
      <input type="text" 
             class="form-input" 
             value="123456789-abcdef.apps.googleusercontent.com"
             data-original="123456789-abcdef.apps.googleusercontent.com"
             id="input-google.client_id">
      <button class="btn-icon reset-btn" 
              title="Reset to original value"
              data-key="google.client_id">
        <i class="icon-reset">↺</i>
      </button>
      <div class="validation-status" id="validation-google.client_id">
        <i class="icon-success">✓</i>
      </div>
    </div>
    <div class="validation-message" id="error-google.client_id"></div>
  </td>
  <td class="description-column">
    <span class="description-text">Google OAuth2 Client ID</span>
    <button class="btn-icon info-btn" title="More information">
      <i class="icon-info">ℹ️</i>
    </button>
  </td>
  <td class="actions-column">
    <button class="btn btn-sm btn-outline-secondary validate-btn"
            data-key="google.client_id">
      Validate
    </button>
  </td>
</tr>
```

#### Edit Mode Row (Sensitive Field)
```html
<tr class="config-row edit-mode sensitive" data-key="google.client_secret" data-category="google">
  <td class="key-column">
    <code>google.client_secret</code>
    <span class="category-badge category-google">Google</span>
    <span class="required-indicator">*</span>
    <span class="sensitive-indicator" title="Sensitive field">🔒</span>
  </td>
  <td class="value-column">
    <div class="value-input-group sensitive-input">
      <input type="password" 
             class="form-input sensitive-field" 
             value="GOCSPX-secretvalue"
             data-original="GOCSPX-secretvalue"
             id="input-google.client_secret"
             placeholder="Enter new value or leave unchanged">
      <button class="btn-icon toggle-visibility" 
              title="Show/Hide value"
              data-key="google.client_secret">
        <i class="icon-show">👁️</i>
      </button>
      <button class="btn-icon reset-btn" 
              title="Reset to original value"
              data-key="google.client_secret">
        <i class="icon-reset">↺</i>
      </button>
      <div class="validation-status" id="validation-google.client_secret">
        <i class="icon-warning">⚠️</i>
      </div>
    </div>
    <div class="validation-message warning" id="error-google.client_secret">
      Changes to this field require confirmation
    </div>
  </td>
  <td class="description-column">
    <span class="description-text">Google OAuth2 Client Secret</span>
    <div class="sensitive-warning">
      <i class="icon-warning">⚠️</i>
      <span>Sensitive: Handle with care</span>
    </div>
  </td>
  <td class="actions-column">
    <button class="btn btn-sm btn-outline-secondary validate-btn"
            data-key="google.client_secret">
      Validate
    </button>
  </td>
</tr>
```

#### Edit Mode Row (Boolean Field)
```html
<tr class="config-row edit-mode" data-key="app.setup_completed" data-category="app">
  <td class="key-column">
    <code>app.setup_completed</code>
    <span class="category-badge category-app">App</span>
  </td>
  <td class="value-column">
    <div class="value-input-group">
      <label class="toggle-switch">
        <input type="checkbox" 
               checked
               data-original="true"
               id="input-app.setup_completed">
        <span class="toggle-slider"></span>
        <span class="toggle-label">Enabled</span>
      </label>
    </div>
  </td>
  <td class="description-column">
    <span class="description-text">Initial setup completion flag</span>
  </td>
  <td class="actions-column">
    <!-- No validation needed for boolean -->
  </td>
</tr>
```

### 3. Validation States

#### Success State
```html
<div class="validation-status success">
  <i class="icon-success">✓</i>
</div>
<div class="validation-message success">
  Valid configuration value
</div>
```

#### Error State
```html
<div class="validation-status error">
  <i class="icon-error">✗</i>
</div>
<div class="validation-message error">
  Invalid Google OAuth Client ID format
  <div class="suggestion">
    Expected format: numbers-string.apps.googleusercontent.com
  </div>
</div>
```

#### Warning State
```html
<div class="validation-status warning">
  <i class="icon-warning">⚠️</i>
</div>
<div class="validation-message warning">
  This change may require service restart
</div>
```

#### Loading State
```html
<div class="validation-status loading">
  <i class="icon-loading spinner">⟳</i>
</div>
<div class="validation-message">
  Validating...
</div>
```

### 4. Confirmation Modal

```html
<div class="modal-overlay" id="confirmModal">
  <div class="modal-dialog">
    <div class="modal-header">
      <h3>Confirm Sensitive Change</h3>
      <button class="btn-close" id="closeModal">&times;</button>
    </div>
    <div class="modal-body">
      <div class="warning-icon">⚠️</div>
      <p>You are about to modify <strong id="fieldName">google.client_secret</strong>.</p>
      <p>This is a sensitive configuration value that may affect system security or functionality.</p>
      <div class="change-preview">
        <div class="current-value">
          <label>Current:</label>
          <code>GOCSPX-********</code>
        </div>
        <div class="new-value">
          <label>New:</label>
          <code id="previewValue">GOCSPX-newvalue</code>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-danger" id="confirmChange">
        <i class="icon-warning">⚠️</i>
        Yes, Update Value
      </button>
      <button class="btn btn-secondary" id="cancelChange">Cancel</button>
    </div>
  </div>
</div>
```

## Interactive Behaviors

### 1. Edit Mode Toggle

#### Entering Edit Mode
```javascript
function enterEditMode() {
  // Update UI state
  document.body.classList.add('edit-mode');
  document.getElementById('modeIndicator').textContent = 'Edit Mode';
  document.getElementById('modeIndicator').className = 'mode-badge edit-mode';
  
  // Show controls
  document.getElementById('configControls').style.display = 'block';
  
  // Convert readonly inputs to editable
  document.querySelectorAll('.config-row').forEach(row => {
    row.classList.add('edit-mode');
    const input = row.querySelector('input, select');
    if (input) {
      input.removeAttribute('readonly');
      input.disabled = false;
    }
  });
  
  // Update button
  const toggle = document.getElementById('editToggle');
  toggle.innerHTML = '<i class="icon-view">👁️</i> Exit Edit Mode';
  toggle.className = 'btn btn-outline-primary';
}
```

#### Exiting Edit Mode
```javascript
function exitEditMode() {
  // Check for unsaved changes
  const hasChanges = document.querySelectorAll('.config-row.changed').length > 0;
  
  if (hasChanges) {
    if (!confirm('You have unsaved changes. Are you sure you want to exit edit mode?')) {
      return;
    }
  }
  
  // Reset UI state
  document.body.classList.remove('edit-mode');
  document.getElementById('modeIndicator').textContent = 'View Mode';
  document.getElementById('modeIndicator').className = 'mode-badge view-mode';
  
  // Hide controls
  document.getElementById('configControls').style.display = 'none';
  
  // Reset all changes
  resetAllChanges();
  
  // Convert inputs back to readonly
  document.querySelectorAll('.config-row').forEach(row => {
    row.classList.remove('edit-mode', 'changed');
    const input = row.querySelector('input, select');
    if (input) {
      input.setAttribute('readonly', true);
      input.disabled = false;
    }
  });
}
```

### 2. Real-time Validation

```javascript
function setupValidation() {
  document.querySelectorAll('.form-input').forEach(input => {
    let validationTimeout;
    
    input.addEventListener('input', function() {
      const key = this.dataset.key || this.id.replace('input-', '');
      const value = this.value;
      const original = this.dataset.original;
      
      // Mark as changed
      if (value !== original) {
        this.closest('.config-row').classList.add('changed');
        updateChangesCount();
      } else {
        this.closest('.config-row').classList.remove('changed');
        updateChangesCount();
      }
      
      // Debounced validation
      clearTimeout(validationTimeout);
      validationTimeout = setTimeout(() => {
        validateField(key, value);
      }, 300);
    });
  });
}

async function validateField(key, value) {
  const statusElement = document.getElementById(`validation-${key}`);
  const errorElement = document.getElementById(`error-${key}`);
  
  // Show loading state
  statusElement.innerHTML = '<i class="icon-loading spinner">⟳</i>';
  statusElement.className = 'validation-status loading';
  
  try {
    const response = await fetch('/config/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: key,
        value: value,
        csrf_token: getCSRFToken()
      })
    });
    
    const result = await response.json();
    
    if (result.valid) {
      statusElement.innerHTML = '<i class="icon-success">✓</i>';
      statusElement.className = 'validation-status success';
      errorElement.textContent = '';
      
      if (result.warnings && result.warnings.length > 0) {
        errorElement.innerHTML = result.warnings.map(w => 
          `<div class="warning">${w}</div>`
        ).join('');
      }
    } else {
      statusElement.innerHTML = '<i class="icon-error">✗</i>';
      statusElement.className = 'validation-status error';
      errorElement.innerHTML = result.error;
      
      if (result.suggestions) {
        errorElement.innerHTML += '<div class="suggestions">' +
          result.suggestions.map(s => `<div class="suggestion">${s}</div>`).join('') +
          '</div>';
      }
    }
  } catch (error) {
    statusElement.innerHTML = '<i class="icon-error">✗</i>';
    statusElement.className = 'validation-status error';
    errorElement.textContent = 'Validation failed. Please try again.';
  }
}
```

### 3. Save Functionality

```javascript
async function saveAllChanges() {
  const changedRows = document.querySelectorAll('.config-row.changed');
  const updates = [];
  
  // Collect all changes
  changedRows.forEach(row => {
    const key = row.dataset.key;
    const input = row.querySelector('input, select');
    const value = input.type === 'checkbox' ? input.checked.toString() : input.value;
    
    updates.push({ key, value });
  });
  
  if (updates.length === 0) {
    showNotification('No changes to save', 'info');
    return;
  }
  
  // Check for sensitive fields
  const sensitiveUpdates = updates.filter(update => 
    isSensitiveField(update.key)
  );
  
  if (sensitiveUpdates.length > 0) {
    const confirmed = await showSensitiveConfirmation(sensitiveUpdates);
    if (!confirmed) {
      return;
    }
  }
  
  // Show loading state
  const saveButton = document.getElementById('saveAll');
  saveButton.disabled = true;
  saveButton.innerHTML = '<i class="spinner">⟳</i> Saving...';
  
  try {
    const response = await fetch('/config/update', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        updates: updates,
        csrf_token: getCSRFToken()
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification(`Successfully updated ${result.updated.length} configuration(s)`, 'success');
      
      // Update original values
      result.updated.forEach(key => {
        const input = document.getElementById(`input-${key}`);
        if (input) {
          input.dataset.original = input.type === 'checkbox' ? input.checked.toString() : input.value;
        }
      });
      
      // Clear changed state
      document.querySelectorAll('.config-row.changed').forEach(row => {
        row.classList.remove('changed');
      });
      
      updateChangesCount();
      
      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          showNotification(warning.message, 'warning');
        });
      }
    } else {
      showNotification('Some configurations failed to update', 'error');
      
      // Show individual errors
      result.errors.forEach(error => {
        const errorElement = document.getElementById(`error-${error.key}`);
        if (errorElement) {
          errorElement.textContent = error.error;
          errorElement.className = 'validation-message error';
        }
      });
    }
  } catch (error) {
    showNotification('Failed to save configurations. Please try again.', 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.innerHTML = 'Save All Changes';
  }
}
```

## Responsive Design

### Desktop (>= 992px)
- Full table layout with all columns visible
- Sidebar for filters and controls
- Inline validation messages

### Tablet (768px - 991px)
- Condensed table layout
- Actions column becomes dropdown menu
- Stacked validation messages

### Mobile (< 768px)
- Card-based layout instead of table
- One configuration per card
- Touch-friendly controls
- Bottom sheet for batch actions

```css
@media (max-width: 767px) {
  .config-table {
    display: none;
  }
  
  .config-cards {
    display: block;
  }
  
  .config-card {
    background: white;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    margin-bottom: 1rem;
    padding: 1rem;
  }
  
  .config-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .config-card-body {
    margin-bottom: 0.5rem;
  }
}
```

## Accessibility

### Keyboard Navigation
- Tab order: Edit toggle → Search → Category filter → Table rows → Save/Cancel
- Arrow keys for table navigation in edit mode
- Enter/Space for button activation
- Escape to cancel modals

### Screen Reader Support
```html
<!-- ARIA labels for dynamic content -->
<div class="mode-indicator" 
     aria-live="polite" 
     aria-label="Current mode">View Mode</div>

<div class="changes-indicator" 
     aria-live="polite" 
     aria-label="Number of changes">0 changes</div>

<!-- Form labels -->
<label for="input-google.client_id" class="sr-only">
  Google Client ID
</label>

<!-- Error messages -->
<div id="error-google.client_id" 
     aria-live="assertive" 
     role="alert"></div>
```

### Color Contrast
- All text meets WCAG AA standards (4.5:1 ratio)
- Icons include text alternatives
- Status indicated by both color and icons
- High contrast mode support

This comprehensive UI specification ensures a secure, accessible, and user-friendly configuration editing experience while maintaining the existing design language and security standards.