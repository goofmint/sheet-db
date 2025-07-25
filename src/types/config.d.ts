// Application configuration
export interface Config {
  environment: 'development' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  corsOrigins: string[];
  maxRequestSize: number;
  requestTimeout: number;
}

// Database configuration from Config table
export interface DatabaseConfig {
  // Google OAuth configuration
  googleClientId?: string;
  googleClientSecret?: string;
  googleAccessTokens?: GoogleAccessToken[];
  
  // Spreadsheet configuration
  spreadsheetId?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  
  // Security configuration
  masterKey?: string;
  configPassword?: string;
  
  // Auth0 configuration
  auth0Domain?: string;
  auth0ClientId?: string;
  auth0ClientSecret?: string;
  
  // Setup status
  setupCompleted: boolean;
  sheetSetupStatus?: string;
  sheetsInitialized?: boolean;
  sheetSetupProgress?: string;
  
  // File storage configuration
  uploadDestination?: 'r2' | 'google_drive';
  googleDriveFolderId?: string;
  
  // Cache configuration
  cacheExpiration: number; // seconds, default: 600
  
  // Permission configuration
  allowCreateTable: boolean;
  allowModifyTable: boolean;
  allowDeleteTable: boolean;
  allowCreateUsers: string[];
  allowCreateRoles: string[];
  allowModifyUsers: string[];
  allowModifyRoles: string[];
  allowDeleteUsers: string[];
  allowDeleteRoles: string[];
}

// Google access token structure
export interface GoogleAccessToken {
  token: string;
  expiresAt: string;
  scope: string;
  refreshToken?: string;
}

// Configuration entry from D1 Config table
export interface ConfigEntry {
  id: number;
  key: string;
  value: string | null;
  valueType: 'string' | 'number' | 'boolean' | 'json';
  createdAt: Date;
  updatedAt: Date;
}