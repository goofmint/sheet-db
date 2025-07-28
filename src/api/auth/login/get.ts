import { Hono } from 'hono';
import { Auth0Service } from '../../../services/auth0';
import { ConfigService } from '../../../services/config';
import { Env } from '../../../types/env';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  try {
    // Get current host and validate redirect URI
    const currentHost = new URL(c.req.url).origin;
    const allowedRedirectBases = JSON.parse(
      ConfigService.getString('allowedRedirectBases', '[]')
    ) as string[];
    
    const allowedBase = allowedRedirectBases.find(base => base === currentHost);
    if (!allowedBase) {
      return c.json({ 
        error: 'Unauthorized redirect base URL',
        message: `Host ${currentHost} is not in allowed redirect bases`
      }, 400);
    }
    
    const redirectUri = `${allowedBase}/api/auth/callback`;
    
    // Generate state parameter for CSRF protection
    const state = crypto.randomUUID();
    
    // TODO: Store state in cache for validation
    // For now, we'll store it in a cookie (temporary solution)
    // In production, use D1 cache table or KV storage
    
    // Get Auth0 authorization URL
    const auth0Service = new Auth0Service(c.env);
    const authUrl = await auth0Service.getAuthorizationUrl(state, redirectUri);
    
    // Set state in cookie for callback validation
    const cookieValue = `auth_state=${state}; HttpOnly; SameSite=Lax; Max-Age=600${currentHost.startsWith('https') ? '; Secure' : ''}; Path=/`;
    
    // Set cookie header directly for better test compatibility
    const response = new Response(null, {
      status: 302,
      headers: {
        'Location': authUrl,
        'Set-Cookie': cookieValue
      }
    });
    
    return response;
    
  } catch (error) {
    console.error('Login error:', error);
    
    // Don't expose internal error details
    const message = error instanceof Error && error.message.includes('Auth0 configuration not found')
      ? 'Authentication service not configured'
      : 'Authentication service unavailable';
    
    return c.json({
      error: 'Authentication failed',
      message
    }, 500);
  }
});

export default app;