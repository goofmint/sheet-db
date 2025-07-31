-- Migration: Initialize validation rules for existing configuration items
-- Date: 2025-07-31
-- Purpose: Set up initial validation rules for all existing configuration items

-- Google OAuth2 configuration
UPDATE Config SET validation = '{"required":true,"pattern":"^[0-9]+-[a-zA-Z0-9]+\\.apps\\.googleusercontent\\.com$","minLength":50,"errorMessage":"Google client ID must be in valid format (*.apps.googleusercontent.com)"}' 
WHERE key = 'google.client_id';

UPDATE Config SET validation = '{"required":true,"minLength":24,"pattern":"^[A-Za-z0-9_-]+$","errorMessage":"Google client secret must be at least 24 alphanumeric characters"}' 
WHERE key = 'google.client_secret';

UPDATE Config SET validation = '{"required":false,"pattern":"^[a-zA-Z0-9-_]{44}$","errorMessage":"Google spreadsheet ID must be 44 alphanumeric characters"}' 
WHERE key = 'google.sheetId';

-- Auth0 configuration
UPDATE Config SET validation = '{"required":true,"pattern":"^[a-zA-Z0-9.-]+\\.(auth0\\.com|eu\\.auth0\\.com|au\\.auth0\\.com)$","errorMessage":"Auth0 domain must be in valid format (*.auth0.com)"}' 
WHERE key = 'auth0.domain';

UPDATE Config SET validation = '{"required":true,"minLength":32,"pattern":"^[A-Za-z0-9]+$","errorMessage":"Auth0 client ID must be at least 32 alphanumeric characters"}' 
WHERE key = 'auth0.client_id';

UPDATE Config SET validation = '{"required":true,"minLength":64,"pattern":"^[A-Za-z0-9_-]+$","errorMessage":"Auth0 client secret must be at least 64 alphanumeric characters"}' 
WHERE key = 'auth0.client_secret';

UPDATE Config SET validation = '{"required":false,"pattern":"^https://[a-zA-Z0-9.-]+/[a-zA-Z0-9/-]*$","errorMessage":"Auth0 audience must be a valid URL"}' 
WHERE key = 'auth0.audience';

UPDATE Config SET validation = '{"required":false,"pattern":"^[a-zA-Z0-9 :]+$","errorMessage":"Auth0 scope must contain valid scope values"}' 
WHERE key = 'auth0.scope';

-- Application configuration
UPDATE Config SET validation = '{"required":true,"minLength":8,"pattern":"^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[A-Za-z\\d@$!%*?&]{8,}$","errorMessage":"Config password must be at least 8 characters with uppercase, lowercase, and digits"}' 
WHERE key = 'app.config_password';

UPDATE Config SET validation = '{"required":true,"type":"boolean","errorMessage":"Setup completed flag must be a boolean value"}' 
WHERE key = 'app.setup_completed';

-- Cache configuration
UPDATE Config SET validation = '{"required":true,"type":"number","min":1,"max":1440,"errorMessage":"Cache TTL must be between 1 and 1440 minutes"}' 
WHERE key = 'cache.ttl_minutes';

UPDATE Config SET validation = '{"required":false,"type":"boolean","default":true,"errorMessage":"Cache enabled flag must be a boolean value"}' 
WHERE key = 'cache.enabled';

-- Storage configuration
UPDATE Config SET validation = '{"required":true,"enum":["r2","gdrive"],"errorMessage":"Storage type must be either r2 or gdrive"}' 
WHERE key = 'storage.type';

UPDATE Config SET validation = '{"required":false,"pattern":"^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$","errorMessage":"R2 bucket name must be in valid format"}' 
WHERE key = 'storage.r2.bucket';

UPDATE Config SET validation = '{"required":false,"minLength":20,"errorMessage":"R2 access key ID must be at least 20 characters"}' 
WHERE key = 'storage.r2.access_key_id';

UPDATE Config SET validation = '{"required":false,"minLength":40,"errorMessage":"R2 secret access key must be at least 40 characters"}' 
WHERE key = 'storage.r2.secret_access_key';

UPDATE Config SET validation = '{"required":false,"pattern":"^https://[a-z0-9.-]+\\.r2\\.cloudflarestorage\\.com$","errorMessage":"R2 endpoint must be a valid Cloudflare R2 endpoint URL"}' 
WHERE key = 'storage.r2.endpoint';

UPDATE Config SET validation = '{"required":false,"pattern":"^[a-zA-Z0-9_-]{28,}$","errorMessage":"Google Drive folder ID must be in valid format"}' 
WHERE key = 'storage.gdrive.folder_id';

-- Mark additional configuration items as system config
UPDATE Config SET system_config = 1 WHERE key IN (
  'auth0.audience',
  'auth0.scope',
  'cache.ttl_minutes',
  'cache.enabled',
  'storage.type',
  'storage.r2.bucket',
  'storage.r2.access_key_id',
  'storage.r2.secret_access_key',
  'storage.r2.endpoint',
  'storage.gdrive.folder_id'
);