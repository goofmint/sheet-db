import { Hono, Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { drizzle } from 'drizzle-orm/d1';
import { SessionService } from '@/services/sessions';
import { ConfigService } from '@/services/config';
import { Env } from '@/types/env';

const app = new Hono<{ Bindings: Env }>();

// Export handler function for OpenAPI integration
export const meHandler = async (c: Context<{ Bindings: Env }>) => {
  try {
    // セッションIDをCookieから取得
    const sessionId = getCookie(c, 'session_id');
    
    if (!sessionId) {
      return c.json({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
      }, 401 as const);
    }

    // Initialize services
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }
    if (!SessionService.isInitialized()) {
      SessionService.initialize(db);
    }

    // Validate session using SessionService
    const sessionValidation = await SessionService.validateSession(sessionId);
    
    if (!sessionValidation.valid) {
      // タイミング攻撃対策: 一定時間待機
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return c.json({
        success: false,
        error: 'unauthorized',
        message: sessionValidation.error || 'Authentication required'
      }, 401 as const);
    }

    // Get user data from _User sheet (required for user info)
    const userData = await SessionService.getUserData(sessionId, c.env);
    
    if (!userData) {
      // _User sheet data not available - this is an error for /me endpoint
      return c.json({
        success: false,
        error: 'user_not_found',
        message: 'User data not found in _User sheet'
      }, 500 as const);
    }

    // Return user data from _User sheet
    return c.json({
      success: true,
      user: {
        id: userData.id,
        name: userData.name || null,
        email: userData.email,
        picture: userData.picture || null,
        email_verified: false, // Default value since not stored in _User sheet
        updated_at: userData.last_login || new Date().toISOString(), // Use last_login as updated_at
        iss: 'sheet-db', // Default issuer
        aud: 'sheet-db', // Default audience
        iat: Math.floor(Date.now() / 1000), // Current timestamp
        exp: Math.floor(Date.parse(sessionValidation.expires_at!) / 1000), // Session expiry
        sub: userData.id,
        sid: sessionValidation.session_id!
      },
      session: {
        session_id: sessionValidation.session_id!,
        expires_at: sessionValidation.expires_at!,
        created_at: userData.created_at || new Date().toISOString()
      }
    }, 200 as const);

  } catch (error) {
    console.error('Auth me error:', error);
    
    // タイミング攻撃対策: エラー時も一定時間待機
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return c.json({
      success: false,
      error: 'server_error',
      message: 'Failed to retrieve user information'
    }, 500 as const);
  }
};

// Traditional Hono route for backwards compatibility
app.get('/', meHandler);

export default app;