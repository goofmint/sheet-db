import { Context } from 'hono';
import { html } from 'hono/html';
import { ConfigService } from '../../services/config';
import SheetSelectionTemplate from '../../templates/sheet-selection';
import { constantTimeEquals } from '../../utils/security';

export async function sheetSelectHandler(c: Context) {
  const accessToken = c.req.query('accessToken');
  
  if (!accessToken) {
    return c.text('Missing access token', 400);
  }
  
  // Get config password from ConfigService
  const configPassword = ConfigService.getString('app.config_password');
  
  if (!configPassword) {
    return c.text('Configuration password not found', 500);
  }
  
  // Check if setup is completed and require authentication
  const isSetupCompleted = ConfigService.getBoolean('app.setup_completed', false);
  
  if (isSetupCompleted) {
    // Check for POST request with password authentication
    if (c.req.method === 'POST') {
      const formData = await c.req.formData();
      const submittedPassword = formData.get('password') as string;
      
      if (!constantTimeEquals(submittedPassword || '', configPassword || '')) {
        return c.html(html`${SheetSelectionTemplate({ 
          accessToken, 
          configPassword, 
          isSetupCompleted: true, 
          error: 'Invalid password. Please try again.' 
        })}`);
      }
      
      // Password is correct, show the sheet selection interface
      return c.html(html`${SheetSelectionTemplate({ accessToken, configPassword, isAuthenticated: true })}`);
    }
    
    // GET request for completed setup - show password form
    return c.html(html`${SheetSelectionTemplate({ 
      accessToken, 
      configPassword, 
      isSetupCompleted: true 
    })}`);
  }
  
  // Setup not completed, show normal interface
  return c.html(html`${SheetSelectionTemplate({ accessToken, configPassword })}`);
}