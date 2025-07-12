# Configuration Documentation

This document describes the configuration system used in Sheet DB, which consists of two storage locations: the Config table (D1 database) and the _Config sheet (Google Sheets).

## Configuration Architecture

### Config Table (D1 Database)
Used for **infrastructure and setup configurations** that are set during initial application setup and rarely changed during runtime.

### _Config Sheet (Google Sheets)
Used for **runtime operational settings** that can be modified by users during normal application operation.

## Config Table (Infrastructure Settings)

## Table Structure

The Config table stores key-value pairs for application configuration:

- `id`: Primary key (auto-increment)
- `name`: Configuration key (unique)
- `value`: Configuration value (text)

## Configuration Items

### Google OAuth Settings

| Key | Description | Example |
|-----|-------------|---------|
| `google_client_id` | Google OAuth 2.0 Client ID | `123456789-abcdef.apps.googleusercontent.com` |
| `google_client_secret` | Google OAuth 2.0 Client Secret | `GOCSPX-xxxxxxxxxxxx` |
| `google_auth_completed` | Flag indicating if Google authentication is complete | `true` or `false` |
| `google_access_token` | Current Google access token | OAuth access token |
| `google_refresh_token` | Google refresh token for renewing access | OAuth refresh token |
| `google_token_expiry` | Expiry timestamp of the access token | ISO 8601 timestamp |

### Auth0 Settings

| Key | Description | Example |
|-----|-------------|---------|
| `auth0_domain` | Auth0 tenant domain | `your-tenant.auth0.com` |
| `auth0_client_id` | Auth0 application Client ID | `xxxxxxxxxxxxxxxxxx` |
| `auth0_client_secret` | Auth0 application Client Secret | `xxxxxxxxxxxxxxxxxx` |
| `auth0_audience` | Auth0 API identifier (optional) | `https://api.example.com` |

### Spreadsheet Settings

| Key | Description | Example |
|-----|-------------|---------|
| `spreadsheet_id` | Google Sheets spreadsheet ID | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms` |
| `spreadsheet_name` | Human-readable spreadsheet name | `My Database Sheet` |
| `spreadsheet_url` | Full URL to the spreadsheet | `https://docs.google.com/spreadsheets/d/...` |
| `sheets_initialized` | Flag indicating if required sheets are created | `true` or `false` |
| `sheet_setup_status` | Current status of sheet setup process | `running`, `completed`, `error` |
| `sheet_setup_id` | UUID for tracking sheet setup process | UUID |
| `sheet_setup_progress` | JSON object with setup progress details | JSON string |

### File Upload Infrastructure Settings

| Key | Description | Example |
|-----|-------------|---------|
| `upload_destination` | Selected file upload destination | `Google Drive` or `R2` |
| `r2_bucket_name` | Cloudflare R2 bucket name | `my-bucket` |
| `r2_access_key_id` | Cloudflare R2 Access Key ID | `xxxxxxxxxxxxxxxxxx` |
| `r2_secret_access_key` | Cloudflare R2 Secret Access Key | `xxxxxxxxxxxxxxxxxx` |
| `r2_account_id` | Cloudflare Account ID | `xxxxxxxxxxxxxxxxxx` |
| `r2_public_url` | Base URL for R2 public file access (lowercase) | `https://your-r2-domain.com` |
| `google_drive_folder_id` | Google Drive folder ID for uploads (optional) | `1A2B3C4D5E6F7G8H9I0J` |

### Security Settings

| Key | Description | Example |
|-----|-------------|---------|
| `reset_token` | Token required to reset setup configuration | Secure random string (min 16 chars) |
| `setup_completed` | Flag indicating if initial setup is complete | `true` or `false` |

## _Config Sheet (Runtime Settings)

The _Config sheet stores runtime operational settings that can be modified during normal application operation:

### Sheet Management Settings

| Key | Description | Default Value |
|-----|-------------|---------------|
| `CREATE_SHEET_BY_API` | Allow sheet creation via API | `false` |
| `CREATE_SHEET_USER` | Array of user IDs allowed to create sheets | `[]` |
| `CREATE_SHEET_ROLE` | Array of roles allowed to create sheets | `[]` |
| `MODIFY_COLUMNS_BY_API` | Allow column modification via API | `false` |
| `MODIFY_SHEET_USER` | Array of user IDs allowed to modify sheets | `[]` |
| `MODIFY_SHEET_ROLE` | Array of roles allowed to modify sheets | `[]` |

### File Upload Runtime Settings

| Key | Description | Default Value |
|-----|-------------|---------------|
| `ANONYMOUS_FILE_UPLOAD` | Allow uploads without authentication | `false` |
| `MAX_FILE_SIZE` | Maximum file size in bytes | `10485760` (10MB) |
| `FILE_UPLOAD_PUBLIC` | Make uploaded files publicly accessible | `true` |
| `ALLOW_UPLOAD_EXTENSION` | Allowed file extensions/types | `image/*` |

### Session Management Settings

| Key | Description | Default Value |
|-----|-------------|---------------|
| `SESSION_EXPIRED_SECONDS` | Session expiration time in seconds (range: 60-2592000) | `3600` (1 hour) |

## Usage Notes

1. **Config Table**: All sensitive values (tokens, secrets) should be stored securely and never exposed in logs or client responses
2. **Config Table**: Boolean flags are stored as string values (`"true"` or `"false"`)
3. **Config Table**: JSON data is stored as stringified JSON in the value field
4. **Config Table**: Used for infrastructure settings set during application setup
5. **_Config Sheet**: All configuration names must be UPPERCASE
6. **_Config Sheet**: Used for runtime settings that can be modified by users
7. **_Config Sheet**: Boolean values are stored as strings (`"true"` or `"false"`)
8. **_Config Sheet**: Array values are stored as JSON strings (e.g., `"[]"` or `"[\"admin\", \"user\"]"`)

## Adding New Configuration Items

### For Config Table (Infrastructure Settings):
1. Update this documentation
2. Add the key to the config array in `/src/api/setup.ts` if it needs to be loaded on the setup page
3. Handle the configuration in the appropriate API endpoints
4. Update the setup form UI if the setting needs to be configurable by users

### For _Config Sheet (Runtime Settings):
1. Update this documentation
2. Add the configuration to `src/sheet-schema.ts` in the `addInitialConfigData()` method
3. Ensure the configuration name is UPPERCASE
4. Use `getMultipleConfigsFromSheet()` or `getConfigFromSheet()` from `src/utils/sheet-helpers.ts` to read values
5. Handle the configuration in the appropriate API endpoints