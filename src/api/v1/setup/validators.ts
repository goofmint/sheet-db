import type { SetupRequest, ValidationError } from './types';
import { ConfigService } from '../../../services/config';

/**
 * Validate the complete setup request
 */
export function validateSetupRequest(data: unknown): {
  isValid: boolean;
  errors: ValidationError[];
  data?: SetupRequest;
} {
  const errors: ValidationError[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'root', message: 'Request body is required' }]
    };
  }

  const req = data as Record<string, unknown>;

  // Check if this is a partial request (sheetId or storage only)
  const hasOnlySheetId = req.sheetId && Object.keys(req).length === 1;
  const hasOnlyStorage = req.storage && Object.keys(req).length === 1;
  const isPartialRequest = hasOnlySheetId || hasOnlyStorage;

  if (hasOnlySheetId) {
    // Simple sheetId validation
    if (typeof req.sheetId !== 'string' || !req.sheetId.trim()) {
      errors.push({ field: 'sheetId', message: 'Valid sheet ID is required' });
    }
    
    if (errors.length === 0) {
      return {
        isValid: true,
        errors: [],
        data: { sheetId: req.sheetId } as SetupRequest
      };
    }
  }

  // For partial requests (including storage-only), check what's already configured
  try {
    const isSetupCompleted = ConfigService.getBoolean('app.setup_completed', false);
    if (isPartialRequest || isSetupCompleted) {
      // Check which configurations already exist
      const hasGoogleConfig = ConfigService.getString('google.client_id') && ConfigService.getString('google.client_secret');
      const hasAuth0Config = ConfigService.getString('auth0.domain') && ConfigService.getString('auth0.client_id') && ConfigService.getString('auth0.client_secret');
      const hasAppConfig = ConfigService.getString('app.config_password');

      // Only validate missing configurations for partial/update requests
      return validatePartialSetupRequest(req, { 
        hasGoogleConfig: !!hasGoogleConfig, 
        hasAuth0Config: !!hasAuth0Config, 
        hasAppConfig: !!hasAppConfig 
      });
    }
  } catch (error) {
    // ConfigService not initialized - treat as fresh setup
    console.warn('ConfigService not initialized in validator, treating as fresh setup');
  }

  // Full setup validation
  // Google OAuth validation
  if (!req.google || typeof req.google !== 'object') {
    errors.push({ field: 'google', message: 'Google configuration is required' });
  } else {
    const google = req.google as Record<string, unknown>;
    
    if (!google.clientId || typeof google.clientId !== 'string' || !google.clientId.trim()) {
      errors.push({ field: 'google.clientId', message: 'Google Client ID is required' });
    } else if (!google.clientId.endsWith('.googleusercontent.com')) {
      errors.push({ field: 'google.clientId', message: 'Invalid Google Client ID format (must end with *.googleusercontent.com)' });
    }

    if (!google.clientSecret || typeof google.clientSecret !== 'string' || !google.clientSecret.trim()) {
      errors.push({ field: 'google.clientSecret', message: 'Google Client Secret is required' });
    }
  }

  // Auth0 validation
  if (!req.auth0 || typeof req.auth0 !== 'object') {
    errors.push({ field: 'auth0', message: 'Auth0 configuration is required' });
  } else {
    const auth0 = req.auth0 as Record<string, unknown>;
    
    if (!auth0.domain || typeof auth0.domain !== 'string' || !auth0.domain.trim()) {
      errors.push({ field: 'auth0.domain', message: 'Auth0 domain is required' });
    } else if (!isValidAuth0Domain(auth0.domain)) {
      errors.push({ field: 'auth0.domain', message: 'Invalid Auth0 domain format (e.g., your-domain.auth0.com)' });
    }

    if (!auth0.clientId || typeof auth0.clientId !== 'string' || !auth0.clientId.trim()) {
      errors.push({ field: 'auth0.clientId', message: 'Auth0 Client ID is required' });
    } else if (auth0.clientId.length !== 32) {
      errors.push({ field: 'auth0.clientId', message: 'Auth0 Client ID must be 32 characters' });
    }

    if (!auth0.clientSecret || typeof auth0.clientSecret !== 'string' || !auth0.clientSecret.trim()) {
      errors.push({ field: 'auth0.clientSecret', message: 'Auth0 Client Secret is required' });
    } else if (auth0.clientSecret.length < 48) {
      errors.push({ field: 'auth0.clientSecret', message: 'Auth0 Client Secret must be at least 48 characters' });
    }
  }

  // App configuration validation
  if (!req.app || typeof req.app !== 'object') {
    errors.push({ field: 'app', message: 'Application configuration is required' });
  } else {
    const app = req.app as Record<string, unknown>;
    
    if (!app.configPassword || typeof app.configPassword !== 'string') {
      errors.push({ field: 'app.configPassword', message: 'Configuration password is required' });
    } else {
      const passwordValidation = validateConfigPassword(app.configPassword);
      if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors.map(error => ({
          field: 'app.configPassword',
          message: error
        })));
      }
    }
  }


  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Type assertion - we've validated all required fields
  return {
    isValid: true,
    errors: [],
    data: req as unknown as SetupRequest
  };
}

/**
 * Validate partial setup request (when some config already exists)
 */
function validatePartialSetupRequest(
  req: Record<string, unknown>, 
  existing: { hasGoogleConfig: boolean; hasAuth0Config: boolean; hasAppConfig: boolean }
): {
  isValid: boolean;
  errors: ValidationError[];
  data?: SetupRequest;
} {
  const errors: ValidationError[] = [];

  // Only validate configurations that don't already exist
  if (req.google && !existing.hasGoogleConfig) {
    const google = req.google as Record<string, unknown>;
    
    if (!google.clientId || typeof google.clientId !== 'string' || !google.clientId.trim()) {
      errors.push({ field: 'google.clientId', message: 'Google Client ID is required' });
    } else if (!google.clientId.endsWith('.googleusercontent.com')) {
      errors.push({ field: 'google.clientId', message: 'Invalid Google Client ID format (must end with *.googleusercontent.com)' });
    }

    if (!google.clientSecret || typeof google.clientSecret !== 'string' || !google.clientSecret.trim()) {
      errors.push({ field: 'google.clientSecret', message: 'Google Client Secret is required' });
    }
  }

  if (req.auth0 && !existing.hasAuth0Config) {
    const auth0 = req.auth0 as Record<string, unknown>;
    
    if (!auth0.domain || typeof auth0.domain !== 'string' || !auth0.domain.trim()) {
      errors.push({ field: 'auth0.domain', message: 'Auth0 domain is required' });
    } else if (!isValidAuth0Domain(auth0.domain)) {
      errors.push({ field: 'auth0.domain', message: 'Invalid Auth0 domain format (e.g., your-domain.auth0.com)' });
    }

    if (!auth0.clientId || typeof auth0.clientId !== 'string' || !auth0.clientId.trim()) {
      errors.push({ field: 'auth0.clientId', message: 'Auth0 Client ID is required' });
    } else if (auth0.clientId.length !== 32) {
      errors.push({ field: 'auth0.clientId', message: 'Auth0 Client ID must be 32 characters' });
    }

    if (!auth0.clientSecret || typeof auth0.clientSecret !== 'string' || !auth0.clientSecret.trim()) {
      errors.push({ field: 'auth0.clientSecret', message: 'Auth0 Client Secret is required' });
    } else if (auth0.clientSecret.length < 48) {
      errors.push({ field: 'auth0.clientSecret', message: 'Auth0 Client Secret must be at least 48 characters' });
    }
  }

  if (req.app && !existing.hasAppConfig) {
    const app = req.app as Record<string, unknown>;
    
    if (!app.configPassword || typeof app.configPassword !== 'string') {
      errors.push({ field: 'app.configPassword', message: 'Configuration password is required' });
    } else {
      const passwordValidation = validateConfigPassword(app.configPassword);
      if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors.map(error => ({
          field: 'app.configPassword',
          message: error
        })));
      }
    }
  }

  // Validate storage if provided
  if (req.storage) {
    const storage = req.storage as Record<string, unknown>;
    
    if (!storage.type || typeof storage.type !== 'string') {
      errors.push({ field: 'storage.type', message: 'Storage type is required' });
    } else if (storage.type === 'r2') {
      const r2 = storage.r2 as Record<string, unknown>;
      if (!r2?.bucket) errors.push({ field: 'storage.r2.bucket', message: 'R2 bucket name is required' });
      if (!r2?.accessKeyId) errors.push({ field: 'storage.r2.accessKeyId', message: 'R2 access key ID is required' });
      if (!r2?.secretAccessKey) errors.push({ field: 'storage.r2.secretAccessKey', message: 'R2 secret access key is required' });
      if (!r2?.endpoint) errors.push({ field: 'storage.r2.endpoint', message: 'R2 endpoint is required' });
    } else if (storage.type === 'gdrive') {
      const gdrive = storage.gdrive as Record<string, unknown>;
      if (!gdrive?.folderId) errors.push({ field: 'storage.gdrive.folderId', message: 'Google Drive folder ID is required' });
    }
  }

  // Validate sheetId if provided
  if (req.sheetId && (typeof req.sheetId !== 'string' || !req.sheetId.trim())) {
    errors.push({ field: 'sheetId', message: 'Valid sheet ID is required' });
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: req as unknown as SetupRequest
  };
}

/**
 * Validate config password strength
 */
export function validateConfigPassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if domain is valid Auth0 domain
 */
function isValidAuth0Domain(domain: string): boolean {
  const auth0Patterns = [
    /^[a-zA-Z0-9-]+\.auth0\.com$/,
    /^[a-zA-Z0-9-]+\.us\.auth0\.com$/,
    /^[a-zA-Z0-9-]+\.eu\.auth0\.com$/,
    /^[a-zA-Z0-9-]+\.au\.auth0\.com$/
  ];

  return auth0Patterns.some(pattern => pattern.test(domain));
}

