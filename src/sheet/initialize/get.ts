import { Context } from 'hono';
import { html } from 'hono/html';
import { ConfigService } from '../../services/config';
import SheetInitializationTemplate from '../../templates/sheet-initialization';
import { constantTimeEquals, validateAccessToken } from '../../utils/security';

export async function sheetInitializeHandler(c: Context) {
  const rawAccessToken = c.req.query('accessToken');
  
  // Validate and sanitize the access token
  const accessToken = validateAccessToken(rawAccessToken);
  
  if (!accessToken) {
    return c.text('Invalid or missing access token', 400);
  }
  
  // Check if ConfigService is properly initialized
  if (!ConfigService.isInitialized()) {
    return c.text('Configuration service not initialized', 500);
  }
  
  // Get config password and master key from ConfigService
  const configPassword = ConfigService.getString('app.config_password');
  let masterKey = ConfigService.getString('app.master_key');
  
  if (!configPassword) {
    return c.text('Configuration password not found', 500);
  }
  
  // If master key is not in database, try to get from environment variable
  if (!masterKey) {
    // @ts-ignore - accessing env through context
    masterKey = c.env?.MASTER_KEY;
  }
  
  // Still no master key? Use a fallback for initial setup
  if (!masterKey) {
    console.warn('Master key not found in config or environment, using temporary fallback');
    masterKey = 'temporary-setup-key';
  }
  
  // Check if setup is completed and require authentication
  const isSetupCompleted = ConfigService.getBoolean('app.setup_completed', false);
  
  if (isSetupCompleted) {
    // Check for POST request with password authentication
    if (c.req.method === 'POST') {
      const formData = await c.req.formData();
      const submittedPassword = formData.get('password') as string;
      
      if (!constantTimeEquals(submittedPassword || '', configPassword || '')) {
        return c.html(html`${SheetInitializationTemplate({ 
          accessToken, 
          configPassword,
          masterKey, 
          isSetupCompleted: true, 
          error: 'Invalid password. Please try again.' 
        })}`);
      }
      
      // Password is correct, show the sheet initialization interface
      return c.html(html`${SheetInitializationTemplate({ accessToken, configPassword, masterKey, isSetupCompleted: true, isAuthenticated: true })}`);
    }
    
    // GET request for completed setup - show password form
    return c.html(html`${SheetInitializationTemplate({ 
      accessToken, 
      configPassword,
      masterKey, 
      isSetupCompleted: true 
    })}`);
  }
  
  // Setup not completed, show normal interface
  return c.html(html`${SheetInitializationTemplate({ accessToken, configPassword, masterKey })}`);
}