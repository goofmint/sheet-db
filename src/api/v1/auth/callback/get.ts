import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { Auth0Service } from '@/services/auth0';
import { ConfigService } from '@/services/config';
import { UserSheet } from '@/sheet/user';
import { drizzle } from 'drizzle-orm/d1';
import { sessionTable } from '@/db/schema';
import { Env } from '@/types/env';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
  try {
    // Initialize ConfigService
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
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
      }, 400);
    }

    // 必須パラメータの検証
    if (!code || !state) {
      return c.json({
        success: false,
        error: 'missing_parameters',
        message: 'Missing required parameters: code and state',
        authenticated: false
      }, 400);
    }

    // State検証（CSRF対策）
    const storedState = getCookie(c, 'auth_state');
    if (!storedState || storedState !== state) {
      return c.json({
        success: false,
        error: 'invalid_state',
        message: 'Invalid state parameter',
        authenticated: false
      }, 400);
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

    // セッション作成
    const sessionId = `sess_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間

    await db.insert(sessionTable).values({
      session_id: sessionId,
      user_id: userInfo.sub,
      user_data: JSON.stringify({
        sub: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      }),
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken || null,
      expires_at: expiresAt.toISOString()
    });

    // セッションIDをHTTPOnlyクッキーに設定
    setCookie(c, 'session_id', sessionId, {
      httpOnly: true,
      secure: currentHost.startsWith('https'),
      sameSite: 'Lax',
      maxAge: 24 * 60 * 60, // 24時間
      path: '/'
    });

    // Stateクッキー削除
    deleteCookie(c, 'auth_state');

    // TODO: Google Sheets が利用可能になったら _User シートから取得
    // 現在はAuth0から取得したユーザー情報を直接使用
    const finalUserData = {
      id: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name || '',
      picture: userInfo.picture || '',
      created_at: now,
      last_login: now
    };

    // 成功レスポンス
    return c.json({
      success: true,
      user: {
        id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        created_at: finalUserData.created_at || now,
        last_login: finalUserData.last_login || now
      },
      session: {
        session_id: sessionId,
        expires_at: expiresAt.toISOString()
      },
      authenticated: true
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
      details: errorMessage, // 開発用の詳細情報
      authenticated: false
    }, 500);
  }
});

export default app;