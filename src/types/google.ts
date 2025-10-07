/**
 * Google OAuth2 and Sheets API type definitions
 */

/**
 * Google OAuth2 token response
 */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Spreadsheet metadata from Google Drive API
 */
export interface SpreadsheetMetadata {
  id: string;
  name: string;
  url: string;
  createdTime: string;
  modifiedTime: string;
}

/**
 * Spreadsheet detailed information from Sheets API
 */
export interface SpreadsheetInfo {
  id: string;
  name: string;
  sheets: SheetInfo[];
}

/**
 * Individual sheet information within a spreadsheet
 */
export interface SheetInfo {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

/**
 * Sheet structure validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  hasUsersSheet: boolean;
  hasRolesSheet: boolean;
  hasFilesSheet: boolean;
}

/**
 * Sheet initialization progress update
 */
export interface SheetInitProgress {
  step: 'users' | 'roles' | 'files' | 'complete';
  message: string;
  completed: boolean;
}

/**
 * Sheet initialization result
 */
export interface SheetInitResult {
  success: boolean;
  createdSheets: string[];
  errors: string[];
}

/**
 * File storage configuration
 */
export interface FileStorageConfig {
  type: 'google_drive' | 'r2';
  googleDriveFolderId?: string;
  r2Config?: R2Config;
}

/**
 * R2 storage configuration
 */
export interface R2Config {
  bucketName: string;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Initial admin user configuration
 */
export interface AdminUserConfig {
  userId: string;
  password: string;
}

/**
 * Complete setup request payload
 */
export interface CompleteSetupRequest {
  sheetId: string;
  fileStorage: FileStorageConfig;
  adminUser: AdminUserConfig;
  masterKey: string;
}
