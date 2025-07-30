# Current API Endpoints

This document lists all currently available API endpoints in the Sheet DB application.

## API Routes (/api/v1/*)

### Health
- `GET /api/v1/health` - Check API health status

### Setup
- `GET /api/v1/setup` - Get setup status
- `POST /api/v1/setup` - Submit setup configuration

### Sheets
- `POST /api/v1/sheets` - Create or initialize sheets

### Storage
- `POST /api/v1/storages` - Create/upload file
- `DELETE /api/v1/storages/:id` - Delete file

### Playground
- `GET /api/v1/playground` - Show API playground

### Auth
- `GET /api/v1/auth/login` - Initiate login
- `GET /api/v1/auth/callback` - OAuth callback
- `POST /api/v1/auth/logout` - Logout user
- `GET /api/v1/auth/me` - Get current user

## Web Routes (Non-API)

### Root
- `GET /` - Root path (redirects to /setup or /playground)

### Static Files
- `GET /statics/*` - Static file serving (CSS, JS assets)

### Google OAuth
- `GET /google/callback` - Google OAuth callback

### Sheet Management
- `GET /sheet/select` - Sheet selection page
- `POST /sheet/select` - Handle sheet selection
- `GET /sheet/initialize` - Sheet initialization page  
- `POST /sheet/initialize` - Handle sheet initialization

### Setup & Playground
- `GET /setup` - Setup page
- `GET /playground` - API playground page

### Configuration Management
- `GET /config` - Configuration management page
- `GET /config/auth` - Configuration authentication
- `POST /config/logout` - Configuration logout

## Notes

- All API routes are prefixed with `/api/v1/`
- Authentication is handled via Auth0
- Static files are served from `/statics/*` path
- The application uses Google Sheets as the primary data store
- Configuration is managed through a web interface at `/config`