# Google Token Management

This document explains the continuous use and management of Google tokens in Sheet DB.

## Overview

Sheet DB uses Google OAuth 2.0 to access Google Sheets. Authentication credentials and access tokens are securely stored in the Config table and automatically refreshed.

## Information Stored in Config Table

### Google OAuth Credentials
- `google_client_id`: Google OAuth Client ID
- `google_client_secret`: Google OAuth Client Secret

### Google Access Tokens
- `google_access_token`: Current access token
- `google_refresh_token`: Refresh token (long-term storage)
- `google_token_expires_at`: Token expiration time (Unix timestamp)
- `google_token_scope`: Authorized scopes

### Other Settings
- `google_auth_completed`: Authentication completion flag
- `oauth_state_*`: Temporary state data for CSRF prevention

## API Endpoints

### 1. POST /connects
Initiates the Google OAuth authentication flow.

**Request:**
```json
{
  "clientId": "your-google-client-id",
  "clientSecret": "your-google-client-secret"
}
```

**Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "csrf-protection-uuid"
}
```

**Processing:**
1. Save Google credentials to Config table
2. Generate OAuth authentication URL
3. Save CSRF prevention state

### 2. GET /auth/callback
Handles callback processing after Google OAuth authentication completion.

**Processing:**
1. Prevent CSRF attacks with state parameter
2. Exchange authorization code for access token
3. Save access token and refresh token to Config table
4. Set authentication completion flag

### 3. POST /auth/refresh
Manually refresh the access token.

**Response:**
```json
{
  "success": true,
  "expires_in": 3600
}
```

### 4. GET /api/token
Retrieve a valid access token (for internal API use).

**Response:**
```json
{
  "access_token": "ya29.xxxxx",
  "expires_in": 3595,
  "scope": "https://www.googleapis.com/auth/spreadsheets ..."
}
```

**Processing:**
1. Check token validity
2. Automatically refresh if invalid
3. Return valid token

## Token Management Flow

### Initial Authentication
1. User enters Google credentials in `/setup`
2. Start OAuth authentication flow with `POST /connects`
3. User completes authentication with Google
4. Retrieve and save tokens in `/auth/callback`

### Continuous Use
1. Application calls `GET /api/token`
2. System automatically checks token validity
3. Automatically refresh if necessary
4. Return valid token

### Token Refresh
- Access token validity: Usually 1 hour
- Refresh token validity: 6 months (if not used)
- Automatic refresh: Available 5 minutes before token expiration

## Security Considerations

### 1. CSRF Protection
- Use state parameter during OAuth authentication
- Generate unique UUID for state and manage in Config table

### 2. Token Encryption
- Stored as plaintext in Config table, database-level encryption recommended for D1
- Implement appropriate access control in production environment

### 3. Token Expiration Management
- Access tokens automatically updated short-term (1 hour)
- Refresh tokens valid long-term, but periodic re-authentication recommended

## Helper Functions

### saveGoogleCredentials(db, credentials)
Save Google OAuth credentials to Config table

### getGoogleCredentials(db)
Retrieve saved Google OAuth credentials

### saveGoogleTokens(db, tokens)
Save Google access token and refresh token

### getGoogleTokens(db)
Retrieve saved Google tokens

### isTokenValid(db)
Check access token validity

### exchangeCodeForTokens(code, redirectUri, credentials)
Exchange authorization code for access token

### refreshAccessToken(refreshToken, credentials)
Update access token using refresh token

## Error Handling

### Common Errors and Solutions

1. **`No refresh token available`**
   - Cause: Refresh token not saved
   - Solution: Re-authentication required

2. **`Token refresh failed`**
   - Cause: Refresh token is invalid
   - Solution: Re-authentication required

3. **`Authentication required`**
   - Cause: Token doesn't exist or is invalid
   - Solution: Start authentication flow from `/setup`

4. **`Invalid state parameter`**
   - Cause: CSRF attack or session timeout
   - Solution: Restart authentication flow from beginning

## Usage Examples

### Google Sheets API Call
```javascript
// Get valid token
const tokenResponse = await fetch('/api/token');
const tokenData = await tokenResponse.json();

// Call Google Sheets API
const sheetsResponse = await fetch(
  'https://sheets.googleapis.com/v4/spreadsheets/SPREADSHEET_ID/values/A1:Z100',
  {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    }
  }
);
```

## Configuration Verification

### Check Config Table Contents
```sql
-- Check saved settings
SELECT name, value FROM Config WHERE name LIKE 'google_%';

-- Check authentication completion status
SELECT value FROM Config WHERE name = 'google_auth_completed';
```

## Important Notes

1. **Refresh Token Management**
   - Refresh tokens are issued only once
   - Re-authentication required if lost

2. **Scope Changes**
   - Re-authentication required when required permissions change
   - Existing tokens cannot access new scopes

3. **Rate Limiting**
   - Google APIs have usage limits
   - Recommend implementing proper error handling and retry functionality