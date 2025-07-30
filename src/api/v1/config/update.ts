import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import { Env } from '@/types/env';
import {
  isAuthenticated,
  verifyCSRFToken,
  getCSRFToken
} from '@/utils/security';

const app = new Hono<{ Bindings: Env }>();

app.post('/', async (c) => {
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
      return c.redirect('/config');
    }

    // Get form data
    const formData = await c.req.formData();
    const csrfToken = formData.get('csrf_token');

    // Verify CSRF token
    const storedCSRFToken = getCSRFToken(c);
    if (!csrfToken || !storedCSRFToken || !verifyCSRFToken(csrfToken.toString(), storedCSRFToken)) {
      return c.redirect('/config?error=csrf_invalid');
    }

    // Extract configuration data from form
    const configs: Record<string, { value: string; type?: 'string' | 'boolean' }> = {};

    // Process each form field
    for (const [key, value] of formData.entries()) {
      if (key === 'csrf_token') continue; // Skip CSRF token

      // Handle different field types
      if (key === 'app.setup_completed') {
        // Checkbox field - convert 'on' to boolean
        configs[key] = { 
          value: (value === 'on' || value === 'true').toString(), 
          type: 'boolean' 
        };
      } else {
        // Regular text/password fields
        configs[key] = { value: value.toString() };
      }
    }

    // Handle checkboxes that are unchecked (not present in form data)
    const allBooleanFields = ['app.setup_completed'];
    for (const booleanField of allBooleanFields) {
      if (!configs[booleanField]) {
        configs[booleanField] = { value: 'false', type: 'boolean' };
      }
    }

    // Save all configurations
    try {
      await ConfigService.setAll(configs);
    } catch (error) {
      console.error('Failed to update configurations:', error);
      return c.redirect('/config?error=update_failed');
    }

    // Redirect back to config page with success message
    return c.redirect('/config?success=updated');

  } catch (error) {
    console.error('Config update error:', error);
    return c.redirect('/config?error=internal_error');
  }
});

export default app;