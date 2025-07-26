import type { SetupRequest, ValidationError } from './types';

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
      errors: [{ field: 'root', message: 'リクエストボディが必要です' }]
    };
  }

  const req = data as Record<string, unknown>;

  // Google OAuth validation
  if (!req.google || typeof req.google !== 'object') {
    errors.push({ field: 'google', message: 'Google設定が必要です' });
  } else {
    const google = req.google as Record<string, unknown>;
    
    if (!google.clientId || typeof google.clientId !== 'string' || !google.clientId.trim()) {
      errors.push({ field: 'google.clientId', message: 'Google Client IDが必要です' });
    } else if (!google.clientId.endsWith('.googleusercontent.com')) {
      errors.push({ field: 'google.clientId', message: 'Google Client IDの形式が正しくありません（*.googleusercontent.com で終わる必要があります）' });
    }

    if (!google.clientSecret || typeof google.clientSecret !== 'string' || !google.clientSecret.trim()) {
      errors.push({ field: 'google.clientSecret', message: 'Google Client Secretが必要です' });
    }
  }

  // Auth0 validation
  if (!req.auth0 || typeof req.auth0 !== 'object') {
    errors.push({ field: 'auth0', message: 'Auth0設定が必要です' });
  } else {
    const auth0 = req.auth0 as Record<string, unknown>;
    
    if (!auth0.domain || typeof auth0.domain !== 'string' || !auth0.domain.trim()) {
      errors.push({ field: 'auth0.domain', message: 'Auth0ドメインが必要です' });
    } else if (!isValidAuth0Domain(auth0.domain)) {
      errors.push({ field: 'auth0.domain', message: 'Auth0ドメインの形式が正しくありません（例: your-domain.auth0.com）' });
    }

    if (!auth0.clientId || typeof auth0.clientId !== 'string' || !auth0.clientId.trim()) {
      errors.push({ field: 'auth0.clientId', message: 'Auth0 Client IDが必要です' });
    } else if (auth0.clientId.length !== 32) {
      errors.push({ field: 'auth0.clientId', message: 'Auth0 Client IDは32文字である必要があります' });
    }

    if (!auth0.clientSecret || typeof auth0.clientSecret !== 'string' || !auth0.clientSecret.trim()) {
      errors.push({ field: 'auth0.clientSecret', message: 'Auth0 Client Secretが必要です' });
    } else if (auth0.clientSecret.length < 48) {
      errors.push({ field: 'auth0.clientSecret', message: 'Auth0 Client Secretは最低48文字必要です' });
    }
  }

  // App configuration validation
  if (!req.app || typeof req.app !== 'object') {
    errors.push({ field: 'app', message: 'アプリケーション設定が必要です' });
  } else {
    const app = req.app as Record<string, unknown>;
    
    if (!app.configPassword || typeof app.configPassword !== 'string') {
      errors.push({ field: 'app.configPassword', message: '設定パスワードが必要です' });
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

  // Database validation (optional)
  if (req.database && typeof req.database === 'object') {
    const database = req.database as Record<string, unknown>;
    
    if (database.url && typeof database.url === 'string') {
      if (!isValidUrl(database.url)) {
        errors.push({ field: 'database.url', message: 'データベースURLの形式が正しくありません' });
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
    data: req as SetupRequest
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
    errors.push('パスワードは8文字以上である必要があります');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('パスワードには大文字を含む必要があります');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('パスワードには小文字を含む必要があります');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('パスワードには数字を含む必要があります');
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

/**
 * Check if string is valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}