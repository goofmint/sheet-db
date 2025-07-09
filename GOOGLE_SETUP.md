# Google Cloud Console Setup Guide

Setup instructions for Google Cloud Console required to use Google Sheets with Sheet DB.

## 1. Google Cloud Console Project Setup

### 1.1 Project Creation
1. Access [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing project

### 1.2 Enable Required APIs
Enable the following APIs:

- **Google Sheets API**
  - Required for reading and writing spreadsheets
  - URL: `https://console.cloud.google.com/apis/library/sheets.googleapis.com`

- **Google Drive API**
  - Required for getting file lists and checking spreadsheet access permissions
  - URL: `https://console.cloud.google.com/apis/library/drive.googleapis.com`

## 2. OAuth 2.0 Credentials Setup

### 2.1 OAuth Consent Screen Configuration
1. Go to `APIs & Services` → `OAuth consent screen`
2. **User Type**: External (for general users) or Internal (organization only)
3. Fill in required information:
   - App name
   - User support email
   - Developer contact information

### 2.2 Create OAuth Client ID
1. Go to `APIs & Services` → `Credentials`
2. `Create Credentials` → `OAuth 2.0 Client IDs`
3. **Application type**: Web application
4. Add the following to **Authorized redirect URIs**:
   ```
   https://your-domain.com/auth/callback
   ```
   - For development: `http://localhost:8787/auth/callback`
   - For production: Use your actual domain

## 3. Permission Scopes

Google scopes required by Sheet DB:

- `https://www.googleapis.com/auth/spreadsheets`
  - Read and write permissions for Google Sheets
- `https://www.googleapis.com/auth/drive.readonly`
  - Google Drive file list access (read-only)

## 4. Environment Variables Setup

### 4.1 Cloudflare Workers Configuration

#### Production Environment (Set as Secrets)
```bash
# Set Client ID
npx wrangler secret put GOOGLE_CLIENT_ID

# Set Client Secret  
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

#### Development Environment (.dev.vars file)
Create a `.dev.vars` file in the project root:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

### 4.2 Environment Variable Reference in wrangler.jsonc
```jsonc
{
  "name": "sheet-db",
  "main": "src/index.ts", 
  // Other configurations...
  "vars": {
    // Set non-sensitive environment variables as needed
  }
}
```

## 5. Security Considerations

### 5.1 CSRF Protection
- Use state parameter in OAuth flow to prevent CSRF attacks
- Generate unique state values and manage them in sessions

### 5.2 Redirect URI Validation
- Verify that post-authentication redirect destinations are legitimate
- Use only authorized redirect URIs

### 5.3 Access Token Management
- Store access tokens with proper encryption
- Don't retain tokens longer than necessary
- Use refresh tokens for periodic updates

## 6. Troubleshooting

### Common Errors

1. **`redirect_uri_mismatch`**
   - Redirect URI not properly configured in Google Cloud Console OAuth settings

2. **`invalid_client`**
   - Client ID or Client Secret is incorrect

3. **`access_denied`**
   - User denied permissions
   - Scopes may not be configured correctly

### Debugging Methods
- Check settings in Google Cloud Console "APIs & Services" → "Credentials"
- Check network tab in browser developer tools
- Check Cloudflare Workers logs

## 7. Reference Links

- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Google Drive API Documentation](https://developers.google.com/drive/api)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)