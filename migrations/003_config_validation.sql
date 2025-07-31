-- Migration: Add validation and system_config columns to Config table
-- Date: 2025-07-31
-- Purpose: Support dynamic validation rules and system configuration protection

-- Add validation column for JSON format validation rules
ALTER TABLE Config ADD COLUMN validation TEXT;

-- Add system_config column for protecting system configurations
ALTER TABLE Config ADD COLUMN system_config INTEGER DEFAULT 0;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_config_system ON Config(system_config);
CREATE INDEX IF NOT EXISTS idx_config_created_at ON Config(created_at);

-- Initialize system configuration flags for existing data
UPDATE Config SET system_config = 1 WHERE key IN (
  'google.client_id',
  'google.client_secret', 
  'google.sheetId',
  'auth0.domain',
  'auth0.client_id',
  'auth0.client_secret',
  'app.config_password',
  'app.setup_completed'
);

-- Set descriptions for system config items (English only)
UPDATE Config SET description = 'Google OAuth2 client ID' WHERE key = 'google.client_id';
UPDATE Config SET description = 'Google OAuth2 client secret' WHERE key = 'google.client_secret';
UPDATE Config SET description = 'Google Sheets spreadsheet ID' WHERE key = 'google.sheetId';
UPDATE Config SET description = 'Auth0 authentication domain' WHERE key = 'auth0.domain';
UPDATE Config SET description = 'Auth0 client ID' WHERE key = 'auth0.client_id';
UPDATE Config SET description = 'Auth0 client secret' WHERE key = 'auth0.client_secret';
UPDATE Config SET description = 'Application configuration password' WHERE key = 'app.config_password';
UPDATE Config SET description = 'Setup completion flag' WHERE key = 'app.setup_completed';

-- Initialize validation rules for system configurations (English error messages)
UPDATE Config SET validation = '{"required":true,"pattern":"^[0-9]+-[a-zA-Z0-9]+\\.apps\\.googleusercontent\\.com$","minLength":50,"errorMessage":"Google client ID must be in valid format (*.apps.googleusercontent.com)"}' 
WHERE key = 'google.client_id';

UPDATE Config SET validation = '{"required":true,"minLength":24,"pattern":"^[A-Za-z0-9_-]+$","errorMessage":"Google client secret must be at least 24 alphanumeric characters"}' 
WHERE key = 'google.client_secret';

UPDATE Config SET validation = '{"required":false,"pattern":"^[a-zA-Z0-9-_]{44}$","errorMessage":"Google spreadsheet ID must be 44 alphanumeric characters"}' 
WHERE key = 'google.sheetId';

UPDATE Config SET validation = '{"required":true,"pattern":"^[a-zA-Z0-9.-]+\\.(auth0\\.com|eu\\.auth0\\.com|au\\.auth0\\.com)$","errorMessage":"Auth0 domain must be in valid format (*.auth0.com)"}' 
WHERE key = 'auth0.domain';

UPDATE Config SET validation = '{"required":true,"minLength":32,"pattern":"^[A-Za-z0-9]+$","errorMessage":"Auth0 client ID must be at least 32 alphanumeric characters"}' 
WHERE key = 'auth0.client_id';

UPDATE Config SET validation = '{"required":true,"minLength":64,"pattern":"^[A-Za-z0-9_-]+$","errorMessage":"Auth0 client secret must be at least 64 alphanumeric characters"}' 
WHERE key = 'auth0.client_secret';

UPDATE Config SET validation = '{"required":true,"minLength":8,"pattern":"^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[A-Za-z\\d@$!%*?&]{8,}$","errorMessage":"Config password must be at least 8 characters with uppercase, lowercase, and digits"}' 
WHERE key = 'app.config_password';

UPDATE Config SET validation = '{"required":true,"type":"boolean","errorMessage":"Setup completed flag must be a boolean value"}' 
WHERE key = 'app.setup_completed';