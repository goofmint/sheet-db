# Configuration Edit Functionality

This document outlines the design and implementation plan for adding editing capabilities to the configuration management interface.

## Overview

The current configuration management interface (`/config`) is read-only, displaying all configuration settings with sensitive data masked. This feature will add the ability to modify configuration values directly through the web interface while maintaining security and data integrity.

## Security Requirements

### Authentication & Authorization
- **Current Security**: Uses HMAC-signed session tokens with CSRF protection
- **Requirement**: All edit operations must require valid authentication and CSRF tokens
- **Session Management**: 2-hour session timeout remains unchanged
- **Access Control**: Only users with valid config password can access edit functionality

### Data Protection
- **Sensitive Data**: Continue masking sensitive values in the UI (passwords, tokens, secrets)
- **Edit Validation**: Sensitive fields require confirmation dialog before modification
- **Audit Trail**: Log all configuration changes (optional for future enhancement)
- **Rollback Protection**: Validate critical settings before applying changes

## User Interface Design

### Current State
- Read-only table with three columns: Configuration Key, Value, Description
- Sensitive values displayed as `****`
- Input fields are `readonly` with title explaining future implementation

### Proposed Changes

#### 1. Edit Mode Toggle
- **Edit Button**: Add "Edit Configuration" button in the header next to logout
- **Mode Indicator**: Visual indication of current mode (View/Edit)
- **Save/Cancel**: Save All and Cancel buttons appear in edit mode
- **Auto-save**: Optional auto-save with debouncing for better UX

#### 2. Enhanced Table Interface
```html
<!-- Edit Mode Table Structure -->
<table>
  <thead>
    <tr>
      <th>Configuration Key</th>
      <th>Value</th>
      <th>Description</th>
      <th>Actions</th> <!-- New column for edit mode -->
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="key-column">google.client_id</td>
      <td class="value-column">
        <input type="text" value="current_value" />
        <button class="reset-btn" title="Reset to original">↺</button>
      </td>
      <td class="description-column">Google OAuth2 Client ID</td>
      <td class="actions-column">
        <button class="validate-btn">Validate</button>
      </td>
    </tr>
  </tbody>
</table>
```

#### 3. Field Types & Validation

##### Text Fields (default)
- Standard text input with validation
- Character limits based on field type
- Pattern validation for URLs, IDs, etc.

##### Password/Secret Fields
- Masked input (`type="password"`)
- "Show/Hide" toggle button
- Confirmation dialog: "Are you sure you want to modify this sensitive setting?"
- Option to regenerate tokens automatically

##### Boolean Fields
- Toggle switch or checkbox
- Clear on/off states with labels

##### JSON Fields
- Code editor with syntax highlighting (Monaco Editor or simple textarea)
- JSON validation before save
- Pretty-print formatting

#### 4. Validation & Error Handling

##### Client-side Validation
- Real-time validation as user types
- Visual indicators (green checkmark, red X)
- Tooltip error messages
- Disable save until all validations pass

##### Server-side Validation
- Schema validation for each configuration type
- Business logic validation (e.g., URL reachability)
- Duplicate key prevention
- Required field enforcement

##### Error Display
```html
<div class="validation-error">
  <i class="error-icon">⚠️</i>
  <span>Invalid URL format. Please enter a valid HTTPS URL.</span>
</div>
```

## API Design

### New Endpoints

#### 1. GET /config/schema
```typescript
// Returns metadata about configuration fields
interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'json';
    sensitive: boolean;
    required: boolean;
    pattern?: string;
    maxLength?: number;
    description: string;
    validation?: {
      url?: boolean;
      email?: boolean;
      custom?: string;
    };
  };
}
```

#### 2. PUT /config/update
```typescript
interface ConfigUpdateRequest {
  updates: Array<{
    key: string;
    value: string;
    type?: ConfigType;
  }>;
  csrf_token: string;
}

interface ConfigUpdateResponse {
  success: boolean;
  updated: string[];
  errors: Array<{
    key: string;
    error: string;
  }>;
}
```

#### 3. POST /config/validate
```typescript
interface ConfigValidateRequest {
  key: string;
  value: string;
  csrf_token: string;
}

interface ConfigValidateResponse {
  valid: boolean;
  error?: string;
  suggestions?: string[];
}
```

### Enhanced Security for API Endpoints

#### CSRF Protection
- All modification endpoints require CSRF tokens
- Token validation before any database operations
- New token generation after successful updates

#### Input Sanitization
- Strict input validation based on field type
- XSS prevention for all user inputs
- SQL injection prevention (already handled by Drizzle ORM)

#### Rate Limiting
- Implement rate limiting for configuration updates
- Maximum 10 updates per minute per session
- Exponential backoff for failed attempts

## Database Considerations

### Transaction Support
- Use database transactions for atomic updates
- Rollback capability if any update in batch fails
- Maintain data consistency across related settings

### Configuration History (Future Enhancement)
```sql
CREATE TABLE config_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_id TEXT
);
```

## Implementation Phases

### Phase 1: Basic Edit Functionality
1. **UI Changes**
   - Add Edit/View mode toggle
   - Convert readonly inputs to editable inputs
   - Add Save/Cancel buttons

2. **API Implementation**
   - Implement PUT /config/update endpoint
   - Add CSRF protection for updates
   - Basic server-side validation

3. **Testing**
   - Unit tests for new API endpoints
   - Integration tests for edit functionality
   - Security testing for CSRF and input validation

### Phase 2: Enhanced Validation & UX
1. **Advanced Validation**
   - Implement GET /config/schema endpoint
   - Add client-side validation
   - Field-specific validation rules

2. **Better UX**
   - Real-time validation feedback
   - Confirmation dialogs for sensitive changes
   - Auto-save functionality

3. **Error Handling**
   - Comprehensive error messages
   - Recovery suggestions
   - Validation error display

### Phase 3: Advanced Features (Future)
1. **Configuration History**
   - Track all changes with timestamps
   - Rollback capability
   - Audit log viewing

2. **Bulk Operations**
   - Import/export configuration
   - Batch updates with validation
   - Configuration templates

## Security Testing Checklist

- [ ] CSRF protection on all edit endpoints
- [ ] Session validation for all operations
- [ ] Input validation prevents XSS
- [ ] Sensitive data remains masked in UI
- [ ] Rate limiting prevents abuse
- [ ] SQL injection protection (via ORM)
- [ ] Error messages don't leak sensitive information
- [ ] Session timeout works correctly during edit operations

## File Structure

```
src/api/v1/config/
├── get.ts           # Enhanced to support edit mode
├── auth.ts          # Existing authentication
├── logout.ts        # Existing logout
├── update.ts        # New: Handle configuration updates
├── schema.ts        # New: Configuration schema endpoint
├── validate.ts      # New: Real-time validation endpoint
└── index.ts         # Updated routes

src/utils/
├── security.ts      # Enhanced with rate limiting
└── config-validation.ts  # New: Configuration validation logic

test/api/v1/config/
├── config.test.ts   # Enhanced existing tests
├── update.test.ts   # New: Test update functionality
├── schema.test.ts   # New: Test schema endpoint
└── validate.test.ts # New: Test validation endpoint
```

## Performance Considerations

### Client-side Performance
- Debounce validation requests (300ms delay)
- Cache validation results
- Minimize DOM updates during edit mode

### Server-side Performance
- Batch validation where possible
- Cache schema information
- Optimize database queries for updates

### Network Optimization
- Gzip compression for large configuration sets
- Incremental updates (only changed values)
- Connection reuse for validation requests

## Backwards Compatibility

- Existing read-only functionality remains unchanged
- New edit functionality is opt-in (requires edit mode activation)
- API remains compatible with existing integrations
- Database schema changes are additive only

This design provides a secure, user-friendly interface for configuration management while maintaining the existing security model and adding comprehensive validation and error handling.