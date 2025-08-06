import { Hono, Context } from 'hono';
import { Auth0Service } from '../../../../services/auth0';
import { ConfigService } from '../../../../services/config';
import { Env } from '../../../../types/env';
import { drizzle } from 'drizzle-orm/d1';

const app = new Hono<{ Bindings: Env }>();

// Export handler function for OpenAPI integration
export const loginHandler = async (c: Context<{ Bindings: Env }>) => {
  try {
    // Initialize ConfigService with database
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }
    
    // Get current host and validate redirect URI
    const currentHost = new URL(c.req.url).origin;
    const allowedRedirectBases = JSON.parse(
      ConfigService.getString('auth.allowed_redirect_bases', '[]')
    ) as string[];
    
    const allowedBase = allowedRedirectBases.find(base => base === currentHost);
    if (!allowedBase) {
      return c.json({ 
        error: 'Unauthorized redirect base URL',
        message: `Host ${currentHost} is not in allowed redirect bases`
      }, 400 as const);
    }
    
    const redirectUri = `${allowedBase}/api/v1/auth/callback`;
    
    // Generate state parameter for CSRF protection
    const state = crypto.randomUUID();
    
    // TODO: Store state in cache for validation
    // For now, we'll store it in a cookie (temporary solution)
    // In production, use D1 cache table or KV storage
    
    // Get Auth0 authorization URL
    const auth0Service = new Auth0Service(c.env);
    const authUrl = await auth0Service.getAuthorizationUrl(state, redirectUri);
    
    // Set state in cookie for callback validation with explicit security attributes
    const isSecure = currentHost.startsWith('https');
    const hostUrl = new URL(currentHost);
    const authCookie = `auth_state=${state}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/; Domain=${hostUrl.hostname}${isSecure ? '; Secure' : ''}`;
    
    // Set cookie header directly for better test compatibility
    const response = new Response(null, {
      status: 302,
      headers: {
        'Location': authUrl,
        'Set-Cookie': authCookie
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
    }, 500 as const);
  }
};

// Traditional Hono route for backwards compatibility
app.get('/', loginHandler);

export default app;