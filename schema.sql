-- Database schema for Sheet DB
-- Cloudflare D1 (SQLite) compatible

-- Drop existing tables if they exist
DROP TABLE IF EXISTS Config;
DROP TABLE IF EXISTS Cache;
DROP TABLE IF EXISTS Session;

-- Config table for application settings
CREATE TABLE Config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cache table for Google Sheets data caching  
CREATE TABLE Cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL UNIQUE,
    data TEXT NOT NULL, -- JSON format data
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON format metadata (schema info, etc.)
);

-- Session table for user session management
CREATE TABLE Session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    user_data TEXT NOT NULL, -- JSON format user info
    access_token TEXT,
    refresh_token TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX idx_config_key ON Config(key);

CREATE INDEX idx_cache_key ON Cache(cache_key);
CREATE INDEX idx_cache_expires_at ON Cache(expires_at);

CREATE INDEX idx_session_session_id ON Session(session_id);
CREATE INDEX idx_session_user_id ON Session(user_id);
CREATE INDEX idx_session_expires_at ON Session(expires_at);

-- Triggers for automatic updated_at column updates
CREATE TRIGGER update_config_updated_at 
    BEFORE UPDATE ON Config
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
    BEGIN
        SELECT NEW.updated_at := CURRENT_TIMESTAMP;
    END;

CREATE TRIGGER update_cache_updated_at 
    BEFORE UPDATE ON Cache
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
    BEGIN
        SELECT NEW.updated_at := CURRENT_TIMESTAMP;
    END;

CREATE TRIGGER update_session_updated_at 
    BEFORE UPDATE ON Session
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
    BEGIN
        SELECT NEW.updated_at := CURRENT_TIMESTAMP;
    END;

-- Initial configuration data
INSERT INTO Config (key, value, type, description) VALUES 
-- Application basic settings
('app.setup_completed', 'false', 'boolean', 'Flag indicating whether setup is completed'),
('app.name', 'Sheet DB', 'string', 'Application name'),
('app.version', '1.0.0', 'string', 'Application version'),

-- Cache settings
('cache.default_ttl', '600', 'number', 'Default cache TTL in seconds'),
('cache.max_entries', '1000', 'number', 'Maximum cache entries'),
('cache.cleanup_interval', '3600', 'number', 'Cache cleanup interval in seconds'),

-- Session settings
('session.default_ttl', '86400', 'number', 'Default session TTL in seconds'),
('session.max_sessions_per_user', '10', 'number', 'Maximum sessions per user'),

-- Google Sheets API settings
('google.sheets.batch_size', '1000', 'number', 'Maximum rows for batch processing'),
('google.sheets.rate_limit_delay', '100', 'number', 'Delay for API rate limit avoidance in milliseconds'),

-- API permissions for sheet operations
('api.sheet.allow_create', 'false', 'boolean', 'Allow sheet creation via API'),
('api.sheet.allow_modify', 'false', 'boolean', 'Allow sheet modification (add/remove columns) via API'),
('api.sheet.allow_delete', 'false', 'boolean', 'Allow sheet deletion via API'),

-- Security settings
('security.api_rate_limit', '100', 'number', 'API request limit per minute'),
('security.cors_origins', '["*"]', 'json', 'Allowed CORS origins (array)'),

-- UI settings
('ui.theme', 'dark', 'string', 'Default theme'),
('ui.language', 'en', 'string', 'Default language'),
('ui.timezone', 'UTC', 'string', 'Default timezone');
