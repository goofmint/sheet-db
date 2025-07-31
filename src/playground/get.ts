import { Context } from 'hono';
import { ConfigService } from '../services/config';
import { AuthService } from '../services/auth';
import { playground } from '../templates/playground';
import type { Env } from '../types/env';

export async function playgroundGetHandler(c: Context<{ Bindings: Env }>) {
  // Check if setup is completed
  const isSetupCompleted = ConfigService.getBoolean('app.setup_completed', false);
  
  if (!isSetupCompleted) {
    return c.redirect('/setup');
  }

  // Get authentication status
  const authService = new AuthService(c.env);
  const auth = await authService.getAuthFromRequest(c);

  // Get the selected Google Sheet ID
  const sheetId = ConfigService.getString('google.sheetId');
  const storageType = ConfigService.getString('storage.type', 'r2');
  
  // Get base URL for API
  const baseUrl = `${c.req.url.split('/playground')[0]}/api/v1`;

  return c.html(playground({
    auth,
    sheetId,
    storageType,
    baseUrl
  }));
}