import { Hono, Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { Auth0Service } from '@/services/auth0';
import { ConfigService } from '@/services/config';
import { SessionService } from '@/services/sessions';
import { UserSheet } from '@/sheet/user';
import { drizzle } from 'drizzle-orm/d1';
import { sessionTable } from '@/db/schema';
import { Env } from '@/types/env';

const app = new Hono<{ Bindings: Env }>();

// Export handler function for OpenAPI integration
export const callbackHandler = async (c: Context<{ Bindings: Env }>) => {
  try {
    // Initialize services
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }
    if (!SessionService.isInitialized()) {
      SessionService.initialize(db);
    }
    
    // クエリパラメータの取得
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');
    const errorDescription = c.req.query('error_description');

    // Auth0エラーの処理
    if (error) {
      return c.json({
        success: false,
        error: error,
        message: errorDescription || 'Authentication failed',
        authenticated: false
      }, 400 as const);
    }

    // 必須パラメータの検証
    if (!code || !state) {
      return c.json({
        success: false,
        error: 'missing_parameters',
        message: 'Missing required parameters: code and state',
        authenticated: false
      }, 400 as const);
    }

    // State検証（CSRF対策）
    const storedState = getCookie(c, 'auth_state');
    if (!storedState || storedState !== state) {
      return c.json({
        success: false,
        error: 'invalid_state',
        message: 'Invalid state parameter',
        authenticated: false
      }, 400 as const);
    }

    // リダイレクトURIの構築
    const currentHost = new URL(c.req.url).origin;
    const redirectUri = `${currentHost}/api/v1/auth/callback`;

    // Auth0トークン交換
    const auth0Service = new Auth0Service(c.env);
    const tokens = await auth0Service.exchangeCodeForToken(code, redirectUri);

    // ユーザー情報取得
    const userInfo = await auth0Service.getUserInfo(tokens.accessToken);

    // _Userシートの更新/作成
    const now = new Date().toISOString();
    
    // ドメイン層のUserSheetを使用してユーザーデータを保存
    try {
      const userSheet = new UserSheet(c.env);
      const userData = await userSheet.upsertUser({
        id: userInfo.sub, // auth0_idをidフィールドにマッピング
        email: userInfo.email,
        name: userInfo.name || '',
        picture: userInfo.picture || '',
        created_at: now,
        last_login: now
      });
      
      if (!userData.success) {
        console.error('Failed to upsert user data (continuing anyway):', userData.error);
        // エラーが発生してもセッション作成は続行
      } else {
        console.log('User data successfully saved to _User sheet');
      }
    } catch (userError) {
      console.error('UserSheetService error (continuing anyway):', userError);
      // エラーが発生してもセッション作成は続行
    }

    // Get client information for security logging
    const ipAddress = c.req.header('CF-Connecting-IP') || 
                     c.req.header('X-Forwarded-For') || 
                     c.req.header('X-Real-IP');
    const userAgent = c.req.header('User-Agent');

    // Create session using SessionService (with refresh token handling)
    const sessionResult = await SessionService.createSession(
      {
        auth0_user_id: userInfo.sub,
        sub: userInfo.sub
      },
      c.env,
      {
        auth0_user_id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        email_verified: userInfo.email_verified,
        sub: userInfo.sub
      }
    );

    if (!sessionResult.success || !sessionResult.session_id) {
      throw new Error(`Session creation failed: ${sessionResult.error}`);
    }

    // Store refresh token separately with rotation support
    let refreshTokenId: string | undefined;
    if (tokens.refreshToken) {
      const refreshTokenResult = await SessionService.storeRefreshToken(
        userInfo.sub,
        tokens.refreshToken,
        ipAddress,
        userAgent
      );

      if (refreshTokenResult.success && refreshTokenResult.token_id) {
        refreshTokenId = refreshTokenResult.token_id;
      }
    }

    // Set secure HTTP-only cookies
    const isSecure = currentHost.startsWith('https');
    
    // Session cookie
    setCookie(c, 'session', sessionResult.session_id, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Strict',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    });

    // Refresh token ID cookie (if available)
    if (refreshTokenId) {
      setCookie(c, 'refresh_token_id', refreshTokenId, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'Strict',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/'
      });
    }

    // CSRF token for refresh endpoint security
    const csrfToken = crypto.randomUUID();
    setCookie(c, 'csrf_token', csrfToken, {
      httpOnly: false, // CSRF token needs to be accessible to JavaScript
      secure: isSecure,
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    });

    // Stateクッキー削除
    deleteCookie(c, 'auth_state');

    // Note: User data is stored in _User sheet for future reference

    // Success response matching CallbackSuccessSchema
    return c.json({
      success: true,
      user: {
        id: userInfo.sub as string,
        email: userInfo.email as string,
        name: (userInfo.name || null) as string | null,
        picture: (userInfo.picture || null) as string | null,
        created_at: now,
        last_login: now
      },
      session: {
        session_id: sessionResult.session_id,
        expires_at: sessionResult.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      authenticated: true
    }, 200 as const, {
      'X-CSRF-Token': csrfToken
    });

  } catch (error) {
    console.error('Callback error:', error);
    
    // エラーレスポンス（開発環境では詳細なエラー情報を含める）
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    
    console.error('Detailed error:', {
      message: errorMessage,
      stack,
      error
    });
    
    return c.json({
      success: false,
      error: 'authentication_failed',
      message: 'Authentication process failed',
      authenticated: false
    }, 500 as const);
  }
};

// Traditional Hono route for backwards compatibility
app.get('/', callbackHandler);

export default app;