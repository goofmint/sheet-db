# Configuration Edit API Specification

This document provides detailed API specifications for the configuration editing functionality.

## Authentication

All endpoints require authentication via session cookies and CSRF protection:

- **Session Cookie**: `config_session` (HttpOnly, Secure, SameSite=Strict)
- **CSRF Token**: `csrf_token` (accessible to JavaScript for form submission)
- **Session Duration**: 2 hours
- **Authentication Method**: HMAC-signed session tokens

## Endpoints

### 1. GET /config/schema

Returns metadata about all configuration fields including validation rules and UI hints.

#### Request
```http
GET /config/schema HTTP/1.1
Host: your-domain.com
Cookie: config_session=<session_token>
```

#### Response
```typescript
interface ConfigSchema {
  [key: string]: ConfigFieldSchema;
}

interface ConfigFieldSchema {
  type: 'string' | 'number' | 'boolean' | 'json';
  sensitive: boolean;
  required: boolean;
  editable: boolean;
  pattern?: string;
  maxLength?: number;
  minLength?: number;
  description: string;
  placeholder?: string;
  validation?: {
    url?: {
      protocols: string[];
      requireTLD: boolean;
    };
    email?: boolean;
    custom?: {
      regex: string;
      message: string;
    };
  };
  dependencies?: string[]; // Keys that this field depends on
  category: 'google' | 'auth0' | 'app' | 'storage';
}
```

#### Example Response
```json
{
  "google.client_id": {
    "type": "string",
    "sensitive": false,
    "required": true,
    "editable": true,
    "pattern": "^[0-9]+-[a-zA-Z0-9]+\\.apps\\.googleusercontent\\.com$",
    "maxLength": 255,
    "description": "Google OAuth2 Client ID",
    "placeholder": "123456789-abcdef.apps.googleusercontent.com",
    "validation": {
      "custom": {
        "regex": "^[0-9]+-[a-zA-Z0-9]+\\.apps\\.googleusercontent\\.com$",
        "message": "Must be a valid Google OAuth Client ID"
      }
    },
    "category": "google"
  },
  "google.client_secret": {
    "type": "string",
    "sensitive": true,
    "required": true,
    "editable": true,
    "maxLength": 255,
    "description": "Google OAuth2 Client Secret",
    "placeholder": "GOCSPX-xxxxxxxxxxxx",
    "category": "google"
  },
  "app.setup_completed": {
    "type": "boolean",
    "sensitive": false,
    "required": true,
    "editable": false,
    "description": "Initial setup completion flag",
    "category": "app"
  }
}
```

#### Status Codes
- `200 OK`: Schema retrieved successfully
- `401 Unauthorized`: Invalid or missing session
- `500 Internal Server Error`: Server error

---

### 2. PUT /config/update

Updates one or more configuration values with validation and atomic transaction support.

#### Request
```http
PUT /config/update HTTP/1.1
Host: your-domain.com
Content-Type: application/json
Cookie: config_session=<session_token>

{
  "updates": [
    {
      "key": "google.client_id",
      "type": "string",
      "value": "123456789-newvalue.apps.googleusercontent.com"
    },
    {
      "key": "app.setup_completed", 
      "type": "boolean",
      "value": true
    },
    {
      "key": "cache.default_ttl",
      "type": "number", 
      "value": 600
    }
  ],
  "csrf_token": "csrf_token_value"
}
```

#### Request Schema
```typescript
interface ConfigUpdateRequest {
  updates: ConfigUpdateItem[];
  csrf_token: string;
}

// Discriminated union for type safety
type ConfigUpdateItem = 
  | ConfigStringUpdate 
  | ConfigNumberUpdate 
  | ConfigBooleanUpdate 
  | ConfigJsonUpdate;

interface ConfigStringUpdate {
  key: string;
  type: 'string';
  value: string;
}

interface ConfigNumberUpdate {
  key: string;
  type: 'number';
  value: number;
}

interface ConfigBooleanUpdate {
  key: string;
  type: 'boolean';
  value: boolean;
}

interface ConfigJsonUpdate {
  key: string;
  type: 'json';
  value: object; // Will be serialized to JSON string
}
```

#### Response
```typescript
interface ConfigUpdateResponse {
  success: boolean;
  updated: string[];
  errors: ConfigUpdateError[];
  warnings?: ConfigUpdateWarning[];
}

interface ConfigUpdateError {
  key: string;
  error: string;
  code: string;
}

interface ConfigUpdateWarning {
  key: string;
  message: string;
  code: string;
}
```

#### Example Response (Success)
```json
{
  "success": true,
  "updated": ["google.client_id", "storage.type"],
  "errors": [],
  "warnings": [
    {
      "key": "storage.type",
      "message": "Changing storage type may affect existing file access",
      "code": "STORAGE_TYPE_CHANGE"
    }
  ]
}
```

#### Example Response (Partial Failure)
```json
{
  "success": false,
  "updated": ["storage.type"],
  "errors": [
    {
      "key": "google.client_id",
      "error": "Invalid Google OAuth Client ID format",
      "code": "INVALID_FORMAT"
    }
  ],
  "warnings": []
}
```

#### Status Codes
- `200 OK`: Update completed (check `success` field for actual result)
- `400 Bad Request`: Invalid request format or CSRF token
- `401 Unauthorized`: Invalid or missing session
- `422 Unprocessable Entity`: Validation errors
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

#### Error Codes
- `INVALID_FORMAT`: Value doesn't match expected format
- `REQUIRED_FIELD`: Required field cannot be empty
- `FIELD_TOO_LONG`: Value exceeds maximum length
- `FIELD_TOO_SHORT`: Value below minimum length
- `INVALID_JSON`: JSON field contains invalid JSON
- `DEPENDENCY_MISSING`: Required dependency not set
- `READONLY_FIELD`: Attempted to modify read-only field
- `UNKNOWN_KEY`: Configuration key not recognized

---

### 3. POST /config/validate

Validates a single configuration value without saving it. Useful for real-time validation.

#### Request
```http
POST /config/validate HTTP/1.1
Host: your-domain.com
Content-Type: application/json
Cookie: config_session=<session_token>

{
  "key": "google.client_id",
  "value": "123456789-test.apps.googleusercontent.com",
  "csrf_token": "csrf_token_value"
}
```

#### Request Schema
```typescript
interface ConfigValidateRequest {
  key: string;
  value: string;
  csrf_token: string;
}
```

#### Response
```typescript
interface ConfigValidateResponse {
  valid: boolean;
  error?: string;
  code?: string;
  suggestions?: string[];
  warnings?: string[];
}
```

#### Example Response (Valid)
```json
{
  "valid": true,
  "warnings": ["This will require re-authentication with Google services"]
}
```

#### Example Response (Invalid)
```json
{
  "valid": false,
  "error": "Invalid Google OAuth Client ID format",
  "code": "INVALID_FORMAT",
  "suggestions": [
    "Format should be: numbers-string.apps.googleusercontent.com",
    "Example: 123456789-abcdef.apps.googleusercontent.com"
  ]
}
```

#### Status Codes
- `200 OK`: Validation completed
- `400 Bad Request`: Invalid request format or CSRF token
- `401 Unauthorized`: Invalid or missing session
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

### 4. POST /config/reset

Resets specific configuration values to their default values.

#### Request
```http
POST /config/reset HTTP/1.1
Host: your-domain.com
Content-Type: application/json
Cookie: config_session=<session_token>

{
  "keys": ["storage.type", "app.config_password"],
  "csrf_token": "csrf_token_value",
  "confirm": true
}
```

#### Request Schema
```typescript
interface ConfigResetRequest {
  keys: string[];
  csrf_token: string;
  confirm: boolean; // Must be true
}
```

#### Response
```typescript
interface ConfigResetResponse {
  success: boolean;
  reset: string[];
  errors: ConfigUpdateError[];
  defaults: Record<string, ConfigDefaultValue>;
}

interface ConfigDefaultValue {
  value: string;
  masked: boolean; // true if value is masked for security
  requiresGeneration?: boolean; // true if value needs to be generated (e.g., tokens)
}
```

#### Status Codes
- `200 OK`: Reset completed
- `400 Bad Request`: Invalid request or missing confirmation
- `401 Unauthorized`: Invalid or missing session
- `500 Internal Server Error`: Server error

---

### 5. POST /config/defaults/secure

Retrieves plaintext default values for sensitive configuration fields. This endpoint requires additional authentication and is rate-limited more strictly.

#### Request
```http
POST /config/defaults/secure HTTP/1.1
Host: your-domain.com
Content-Type: application/json
Cookie: config_session=<session_token>

{
  "keys": ["google.client_secret", "auth0.client_secret"],
  "csrf_token": "csrf_token_value",
  "confirmation": "I understand the security implications"
}
```

#### Request Schema
```typescript
interface SecureDefaultsRequest {
  keys: string[];
  csrf_token: string;
  confirmation: string; // Must be exact string for security confirmation
}
```

#### Response
```typescript
interface SecureDefaultsResponse {
  success: boolean;
  values: Record<string, string>;
  errors: ConfigUpdateError[];
  accessed_at: string; // ISO timestamp for audit
}
```

#### Example Response
```json
{
  "success": true,
  "values": {
    "google.client_secret": "GOCSPX-default_generated_secret",
    "auth0.client_secret": "auth0_default_secret_value"
  },
  "errors": [],
  "accessed_at": "2024-01-15T10:30:00.000Z"
}
```

#### Status Codes
- `200 OK`: Secure defaults retrieved
- `400 Bad Request`: Invalid request or missing confirmation
- `401 Unauthorized`: Invalid or missing session
- `403 Forbidden`: Insufficient permissions for secure access
- `429 Too Many Requests`: Rate limit exceeded (stricter than other endpoints)
- `500 Internal Server Error`: Server error

#### Security Features
- **Enhanced Rate Limiting**: 3 requests per hour per session
- **Audit Logging**: All access logged with session information
- **Confirmation Required**: Explicit confirmation string required
- **Time-Limited**: Responses expire and cannot be cached
- **IP Tracking**: IP address logged for security monitoring

---

## Rate Limiting

Endpoints are rate-limited with different restrictions based on security requirements:

### Standard Modification Endpoints
`PUT /config/update`, `POST /config/reset`:
- **Limit**: 10 requests per minute per session
- **Window**: 60 seconds sliding window

### Sensitive Data Endpoints
`POST /config/defaults/secure`:
- **Limit**: 3 requests per hour per session
- **Window**: 3600 seconds sliding window
- **Additional**: IP-based tracking and anomaly detection

### All Endpoints Headers
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Timestamp when window resets
- `X-RateLimit-Type`: Standard, sensitive, or validation

#### Rate Limit Response
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 30
}
```

## CSRF Protection

All endpoints that modify data use a double-submit-cookie pattern for enhanced security:

### Double-Submit-Cookie Pattern
1. **Token Generation**: Server generates a cryptographically secure CSRF token
2. **Cookie Setting**: Token set as HttpOnly, Secure, SameSite=Strict cookie (`csrf_token`)
3. **Form Field**: Same token embedded as hidden form field or request header
4. **Validation**: Server validates that cookie token matches submitted token
5. **Benefits**: Not accessible to JavaScript, immune to XSS token theft

### Implementation Details
- **Cookie Name**: `csrf_token`
- **Cookie Attributes**: `HttpOnly; Secure; SameSite=Strict`
- **Header Name**: `X-CSRF-Token` (alternative to form field)
- **Token Lifetime**: Same as session (2 hours)
- **Token Rotation**: New token generated after successful updates
- **Validation**: Constant-time comparison to prevent timing attacks

### Request Patterns

#### Form-based Requests
```html
<form method="post" action="/config/update">
  <input type="hidden" name="csrf_token" value="server_generated_token">
  <!-- Other form fields -->
</form>
```

#### AJAX Requests
```javascript
// Token automatically included in cookie, no JavaScript access needed
fetch('/config/update', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': 'server_provided_token' // From server-rendered page
  },
  body: JSON.stringify(data)
});
```

### Fallback for JavaScript-Disabled Environments
- Hidden form fields with server-rendered tokens
- Form submission validation without client-side JavaScript
- Graceful degradation maintains full security

## Validation Rules

### Field-Specific Validation

#### Google OAuth Fields
- `google.client_id`: Must match Google OAuth Client ID format
- `google.client_secret`: Must start with `GOCSPX-`
- `google.access_token`: Must be valid OAuth token format
- `google.refresh_token`: Must be valid OAuth token format

#### Auth0 Fields
- `auth0.domain`: Must be valid domain format
- `auth0.client_id`: Must be alphanumeric string
- `auth0.client_secret`: Must be alphanumeric string
- `auth0.audience`: Must be valid URL (optional)

#### Storage Fields
- `storage.type`: Must be 'r2' or 'google_drive'
- `storage.r2.secretAccessKey`: Must be valid AWS-style access key
- `storage.r2.endpoint`: Must be valid HTTPS URL

#### App Fields
- `app.config_password`: Minimum 8 characters, maximum 256 characters
- `app.setup_completed`: Must be 'true' or 'false'

### Cross-Field Validation

Some fields have dependencies on other fields:

- R2 storage fields require `storage.type` to be 'r2'
- Google Drive fields require `storage.type` to be 'google_drive'
- OAuth tokens require corresponding client credentials

## Error Handling

### Client-Side Error Handling
```typescript
try {
  const response = await fetch('/config/update', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateRequest)
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    if (response.status === 429) {
      // Handle rate limiting
      showRateLimitError(result.retry_after);
    } else if (response.status === 401) {
      // Redirect to login
      window.location.href = '/config';
    } else {
      // Handle other errors
      showErrors(result.errors);
    }
    return;
  }
  
  if (result.success) {
    showSuccess(result.updated);
    if (result.warnings) {
      showWarnings(result.warnings);
    }
  } else {
    showErrors(result.errors);
  }
} catch (error) {
  showNetworkError();
}
```

### Server-Side Error Logging
All errors should be logged with appropriate context:

```typescript
console.error('Config update failed', {
  sessionId: getSessionId(c),
  updates: sanitizeForLogging(updates),
  errors: validationErrors,
  timestamp: new Date().toISOString()
});
```

## Testing Scenarios

### Security Testing
- [ ] CSRF token validation
- [ ] Session validation
- [ ] Rate limiting enforcement
- [ ] Input sanitization
- [ ] SQL injection prevention
- [ ] XSS prevention

### Functionality Testing
- [ ] Valid updates succeed
- [ ] Invalid updates fail with appropriate errors
- [ ] Batch updates are atomic
- [ ] Field validation works correctly
- [ ] Dependencies are enforced
- [ ] Sensitive data masking

### Performance Testing
- [ ] Response times under load
- [ ] Rate limiting accuracy
- [ ] Database transaction performance
- [ ] Concurrent update handling

This API specification provides a comprehensive and secure foundation for configuration editing functionality while maintaining backwards compatibility and strong security practices.