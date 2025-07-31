import { Hono, Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { sessionTable } from '@/db/schema';
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
      }, 401);
    }

    // データベース接続
    const db = drizzle(c.env.DB);

    // セッション情報を取得
    const sessions = await db.select()
      .from(sessionTable)
      .where(eq(sessionTable.session_id, sessionId))
      .limit(1);

    if (sessions.length === 0) {
      // タイミング攻撃対策: 一定時間待機
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return c.json({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
      }, 401);
    }

    const session = sessions[0];

    // セッション有効期限を確認
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (now >= expiresAt) {
      // 期限切れセッションは削除
      await db.delete(sessionTable)
        .where(eq(sessionTable.session_id, sessionId));
      
      // タイミング攻撃対策: 一定時間待機
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return c.json({
        success: false,
        error: 'session_expired',
        message: 'Session has expired'
      }, 401);
    }

    // ユーザーデータをパース
    let userData;
    try {
      userData = JSON.parse(session.user_data);
    } catch (error) {
      console.error('Failed to parse user_data:', error);
      
      // タイミング攻撃対策: 一定時間待機
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return c.json({
        success: false,
        error: 'server_error',
        message: 'Failed to retrieve user information'
      }, 500);
    }

    // レスポンス返却
    return c.json({
      success: true,
      user: {
        id: userData.sub,
        name: userData.name,
        email: userData.email,
        picture: userData.picture,
        email_verified: userData.email_verified,
        updated_at: userData.updated_at,
        iss: userData.iss,
        aud: userData.aud,
        iat: userData.iat,
        exp: userData.exp,
        sub: userData.sub,
        sid: userData.sid
      },
      session: {
        session_id: session.session_id,
        expires_at: session.expires_at,
        created_at: session.created_at
      }
    });

  } catch (error) {
    console.error('Auth me error:', error);
    
    // タイミング攻撃対策: エラー時も一定時間待機
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return c.json({
      success: false,
      error: 'server_error',
      message: 'Failed to retrieve user information'
    }, 500);
  }
};

// Traditional Hono route for backwards compatibility
app.get('/', meHandler);

export default app;