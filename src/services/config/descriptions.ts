/**
 * Configuration key descriptions and metadata
 */
export class ConfigDescriptions {
  private static readonly descriptions: Record<string, string> = {
    // Google services
    'google.client_id': 'Google OAuth Client ID',
    'google.client_secret': 'Google OAuth Client Secret',
    'google.sheetId': 'Selected Google Sheet ID',
    
    // Auth0 services
    'auth0.domain': 'Auth0 Domain',
    'auth0.client_id': 'Auth0 Client ID',
    'auth0.client_secret': 'Auth0 Client Secret',
    
    // Application settings
    'app.config_password': 'Configuration Password',
    'app.setup_completed': 'Setup completion status',
    
    // Storage settings
    'storage.type': 'File storage type',
    'storage.r2.bucket': 'R2 bucket name',
    'storage.r2.accessKeyId': 'R2 access key ID',
    'storage.r2.secretAccessKey': 'R2 secret access key',
    'storage.r2.endpoint': 'R2 endpoint URL',
    'storage.gdrive.folderId': 'Google Drive folder ID',
    
    // File upload settings
    'upload.enabled': 'Enable or disable file upload functionality',
    'upload.max_file_size': 'Maximum file size for uploads in bytes',
    'upload.allowed_types': 'List of allowed MIME types for file uploads'
  };

  /**
   * Get description for a config key
   */
  static getDescription(key: string): string {
    // Return specific description or generate one based on key pattern
    if (this.descriptions[key]) {
      return this.descriptions[key];
    }

    // Generate description from key pattern
    const parts = key.split('.');
    if (parts.length >= 2) {
      const service = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const setting = parts.slice(1).join(' ').replace(/([A-Z])/g, ' $1').toLowerCase();
      return `${service} ${setting}`;
    }

    return `Configuration setting: ${key}`;
  }

  /**
   * Check if a key is considered sensitive
   */
  static isSensitive(key: string): boolean {
    const sensitivePatterns = [
      'secret',
      'password',
      'token',
      'key'
    ];
    
    const lowercaseKey = key.toLowerCase();
    return sensitivePatterns.some(pattern => lowercaseKey.includes(pattern));
  }
}