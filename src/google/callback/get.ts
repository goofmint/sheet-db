import { Context } from 'hono';
import { html } from 'hono/html';
import { ConfigService } from '../../services/config';
import SheetSelectionTemplate from '../../templates/sheet-selection';
import ErrorPageTemplate from '../../templates/oauth-error';

/**
 * Google OAuth 2.0 token response interface
 */
interface GoogleOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  refresh_token?: string;
  id_token?: string;
}

export async function googleCallbackHandler(c: Context) {
  const code = c.req.query('code');
  const errorParam = c.req.query('error');
  
  if (errorParam) {
    return c.html(html`${ErrorPageTemplate({ title: "Authentication Error", message: errorParam })}`);
  }
  
  if (!code) {
    return c.html(html`${ErrorPageTemplate({ title: "Authentication Error", message: "No authorization code received" })}`);
  }

  try {
    // Get client credentials from config
    const clientId = ConfigService.getString('google.client_id');
    const clientSecret = ConfigService.getString('google.client_secret');
    
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${new URL(c.req.url).origin}/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json() as GoogleOAuthTokenResponse;
    
    // Save access token to Config table
    await ConfigService.upsert('google.access_token', tokenData.access_token, 'string', 'Google OAuth access token');
    
    if (tokenData.refresh_token) {
      await ConfigService.upsert('google.refresh_token', tokenData.refresh_token, 'string', 'Google OAuth refresh token');
    }

    // Redirect to sheet selection page with access token
    return c.redirect(`/sheet/select?accessToken=${encodeURIComponent(tokenData.access_token)}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.html(html`${ErrorPageTemplate({ title: "Authentication Failed", message: errorMessage })}`);
  }
}