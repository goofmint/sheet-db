/**
 * Setting Definition Service
 * Manages setting definitions (metadata) for the configuration system
 * New settings can be added by updating the loadDefinitions() method
 */

import type { SettingDefinition } from '../types/settings';

/**
 * Service that provides setting definitions for all system settings
 * Centralizes the configuration schema to make adding new settings easy
 */
export class SettingDefinitionService {
  private definitions: SettingDefinition[];

  constructor() {
    // Load all setting definitions
    // To add a new setting, simply add it to the array in loadDefinitions()
    this.definitions = this.loadDefinitions();
  }

  /**
   * Get all setting definitions
   * @returns Array of all setting definitions
   */
  getAllDefinitions(): SettingDefinition[] {
    return this.definitions;
  }

  /**
   * Get setting definitions filtered by category
   * @param category - Category to filter by (e.g., 'google', 'file', 'security')
   * @returns Array of setting definitions in the specified category
   */
  getDefinitionsByCategory(category: string): SettingDefinition[] {
    return this.definitions.filter((def) => def.category === category);
  }

  /**
   * Get a specific setting definition by key
   * @param key - Setting key to look up
   * @returns Setting definition or null if not found
   */
  getDefinition(key: string): SettingDefinition | null {
    return this.definitions.find((def) => def.key === key) ?? null;
  }

  /**
   * Load all setting definitions
   * This is the centralized location for all system settings
   * To add a new setting, simply add an entry to this array
   *
   * @returns Array of setting definitions
   */
  private loadDefinitions(): SettingDefinition[] {
    return [
      // Google API Settings
      {
        key: 'google_client_id',
        label: 'Google Client ID',
        description: 'Google OAuth 2.0 Client ID for authentication',
        category: 'google',
        type: 'string',
        defaultValue: '',
        validation: { required: true },
      },
      {
        key: 'google_client_secret',
        label: 'Google Client Secret',
        description: 'Google OAuth 2.0 Client Secret',
        category: 'google',
        type: 'password',
        defaultValue: '',
        validation: { required: true },
        sensitive: true,
      },
      {
        key: 'selected_sheet_id',
        label: 'Google Sheet ID',
        description: 'Main Google Sheet ID for data storage',
        category: 'google',
        type: 'string',
        defaultValue: '',
        validation: { required: true },
      },

      // File Management Settings
      {
        key: 'max_file_size',
        label: 'Maximum File Size',
        description: 'Maximum file upload size in bytes',
        category: 'file',
        type: 'number',
        defaultValue: 10485760, // 10MB
        validation: { min: 1024, max: 104857600 }, // 1KB - 100MB
      },
      {
        key: 'allowedFileTypes',
        label: 'Allowed File Types',
        description: 'Comma-separated list of allowed MIME types',
        category: 'file',
        type: 'array',
        defaultValue: [],
      },
      {
        key: 'storageType',
        label: 'Storage Type',
        description: 'File storage backend (r2 or google_drive)',
        category: 'file',
        type: 'string',
        defaultValue: 'google_drive',
        validation: { enum: ['r2', 'google_drive'] },
      },
      {
        key: 'r2_account_id',
        label: 'R2 Account ID',
        description: 'Cloudflare R2 Account ID',
        category: 'file',
        type: 'string',
        defaultValue: '',
      },
      {
        key: 'r2_access_key_id',
        label: 'R2 Access Key ID',
        description: 'Cloudflare R2 Access Key ID',
        category: 'file',
        type: 'password',
        defaultValue: '',
        sensitive: true,
      },
      {
        key: 'r2_secret_access_key',
        label: 'R2 Secret Access Key',
        description: 'Cloudflare R2 Secret Access Key',
        category: 'file',
        type: 'password',
        defaultValue: '',
        sensitive: true,
      },
      {
        key: 'r2_bucket_name',
        label: 'R2 Bucket Name',
        description: 'Cloudflare R2 Bucket Name',
        category: 'file',
        type: 'string',
        defaultValue: '',
      },
      {
        key: 'googleDriveFolderId',
        label: 'Google Drive Folder ID',
        description: 'Google Drive folder for file storage',
        category: 'file',
        type: 'string',
        defaultValue: '',
      },

      // Cache Settings
      {
        key: 'cacheTTL',
        label: 'Cache TTL',
        description: 'Cache time-to-live in seconds',
        category: 'cache',
        type: 'number',
        defaultValue: 300, // 5 minutes
        validation: { min: 0, max: 86400 }, // 0 - 24 hours
      },
      {
        key: 'cacheEnabled',
        label: 'Cache Enabled',
        description: 'Enable or disable caching',
        category: 'cache',
        type: 'boolean',
        defaultValue: true,
      },

      // Security Settings
      {
        key: 'jwtSecret',
        label: 'JWT Secret',
        description: 'Secret key for JWT token signing',
        category: 'security',
        type: 'password',
        defaultValue: '',
        validation: { required: true },
        sensitive: true,
      },
      {
        key: 'sessionTimeout',
        label: 'Session Timeout',
        description: 'Session timeout in seconds',
        category: 'security',
        type: 'number',
        defaultValue: 3600, // 1 hour
        validation: { min: 60, max: 86400 }, // 1 minute - 24 hours
      },
      {
        key: 'masterKey',
        label: 'Master Key',
        description: 'System master key for administrative access',
        category: 'security',
        type: 'password',
        defaultValue: '',
        validation: { required: true },
        sensitive: true,
      },

      // Rate Limiting Settings
      {
        key: 'rateLimitRequests',
        label: 'Rate Limit Requests',
        description: 'Maximum number of requests per time window',
        category: 'rateLimit',
        type: 'number',
        defaultValue: 100,
        validation: { min: 1, max: 10000 },
      },
      {
        key: 'rateLimitWindow',
        label: 'Rate Limit Window',
        description: 'Time window for rate limiting in seconds',
        category: 'rateLimit',
        type: 'number',
        defaultValue: 60, // 1 minute
        validation: { min: 1, max: 3600 }, // 1 second - 1 hour
      },

      // To add new settings, simply add them here following the same pattern
    ];
  }
}
