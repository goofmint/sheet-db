import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import { Env } from '@/types/env';
import type { ConfigWithValidation } from '@/utils/validation-types';
import {
  isAuthenticated,
  generateCSRFToken,
  setCSRFCookie,
  getCSRFToken
} from '@/utils/security';
import { ConfigForm } from '../templates/config/form';
import { LoginForm } from '../templates/config/login';
import { getFieldMetadata } from '@/repositories/config-validation';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  try {
    // Initialize ConfigService
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }

    // Check authentication using secure session token
    const configPassword = ConfigService.getString('app.config_password');
    const authenticated = await isAuthenticated(c, configPassword);

    if (!authenticated) {
      // Generate CSRF token for the login form
      const csrfToken = generateCSRFToken();
      setCSRFCookie(c, csrfToken);

      // Unauthenticated: password input form
      return c.html(LoginForm({ csrfToken }));
    }

    // Authenticated: display configuration list
    const configs = ConfigService.getAll();
    
    // Use existing CSRF token if available, otherwise generate new one
    let csrfToken = getCSRFToken(c);
    if (!csrfToken) {
      csrfToken = generateCSRFToken();
      setCSRFCookie(c, csrfToken);
    }
    
    // Prepare configuration data (sensitive data shown as password fields)
    const configList = Object.entries(configs).map(([key, value]) => {
      const metadata = getFieldMetadata(key);
      const type = ConfigService.getType(key);
      
      return {
        key,
        value: String(value),
        type,
        isSensitive: metadata.sensitive,
        description: getConfigDescription(key),
        validation: null, // Will be handled by frontend JavaScript
        system_config: false
      };
    });

    return c.html(ConfigForm({ configList, csrfToken }));

  } catch (error) {
    console.error('Config page error:', error);
    return c.html(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Error - Configuration Management</title>
      </head>
      <body>
        <h1>An Error Occurred</h1>
        <p>An error occurred while loading the configuration.</p>
        <a href="/playground">Back to Playground</a>
      </body>
      </html>
    `, 500);
  }
});



// Function to get configuration item descriptions
function getConfigDescription(key: string): string {
  const descriptions: Record<string, string> = {
    'google.client_id': 'Google OAuth2 Client ID',
    'google.client_secret': 'Google OAuth2 Client Secret',
    'google.access_token': 'Google OAuth2 Access Token',
    'google.refresh_token': 'Google OAuth2 Refresh Token',
    'auth0.domain': 'Auth0 Domain',
    'auth0.client_id': 'Auth0 Application Client ID',
    'auth0.client_secret': 'Auth0 Application Client Secret',
    'auth0.audience': 'Auth0 API Audience (optional)',
    'storage.type': 'File storage type (r2 | google_drive)',
    'storage.r2.accountId': 'R2 Account ID',
    'storage.r2.accessKeyId': 'R2 Access Key ID',
    'storage.r2.secretAccessKey': 'R2 Secret Access Key',
    'storage.r2.bucketName': 'R2 Bucket Name',
    'storage.r2.endpoint': 'R2 API Endpoint URL',
    'app.config_password': 'Configuration screen access password',
    'app.setup_completed': 'Initial setup completion flag',
  };
  
  return descriptions[key] || 'Configuration item';
}

export default app;