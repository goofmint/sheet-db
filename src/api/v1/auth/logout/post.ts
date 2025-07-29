import { Hono } from 'hono';
import { getCookie, deleteCookie } from 'hono/cookie';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { sessionTable } from '@/db/schema';
import { Env } from '@/types/env';

const app = new Hono<{ Bindings: Env }>();

app.post('/', async (c) => {
  try {
    // CSRF保護: X-Requested-Withヘッダーの検証
    const requestedWith = c.req.header('X-Requested-With');
    if (requestedWith !== 'XMLHttpRequest') {
      return c.json({
        success: false,
        error: 'invalid_request',
        message: 'Invalid request headers'
      }, 400);
    }

    // Origin/Refererヘッダーの検証
    const origin = c.req.header('Origin');
    const referer = c.req.header('Referer');
    const currentOrigin = new URL(c.req.url).origin;
    
    // OriginまたはRefererヘッダーが必須
    if (!origin && !referer) {
      return c.json({
        success: false,
        error: 'missing_origin_headers',
        message: 'Origin or Referer header is required'
      }, 400);
    }
    
    // 存在するヘッダーを検証
    const headerToValidate = origin || referer;
    if (headerToValidate && !headerToValidate.startsWith(currentOrigin)) {
      return c.json({
        success: false,
        error: 'invalid_origin',
        message: 'Invalid request origin'
      }, 400);
    }

    // セッションIDをCookieから取得
    const sessionId = getCookie(c, 'session_id');
    
    if (!sessionId) {
      return c.json({
        success: false,
        error: 'unauthorized',
        message: 'No active session found'
      }, 401);
    }

    // データベース接続
    const db = drizzle(c.env.DB);

    // セッションの存在確認とユーザーID取得（ログ記録用）
    const existingSession = await db.select({
      user_id: sessionTable.user_id
    }).from(sessionTable)
      .where(eq(sessionTable.session_id, sessionId))
      .limit(1);

    let userId = 'unknown';
    if (existingSession.length > 0) {
      userId = existingSession[0].user_id;
    }

    // セッションをデータベースから削除
    await db.delete(sessionTable)
      .where(eq(sessionTable.session_id, sessionId));

    // セッションCookieを削除（SameSite=Strictで CSRF対策強化）
    deleteCookie(c, 'session_id', {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === 'https:',
      sameSite: 'Strict',
      path: '/'
    });

    // ログアウトイベントの記録
    console.log(`User logged out: ${userId} at ${new Date().toISOString()}`);

    // タイミング攻撃対策: 一定時間待機
    await new Promise(resolve => setTimeout(resolve, 100));

    return c.json({
      success: true,
      message: 'Successfully logged out'
    });

  } catch (error) {
    console.error('Logout error:', error);
    
    // タイミング攻撃対策: エラー時も一定時間待機
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return c.json({
      success: false,
      error: 'logout_failed',
      message: 'Logout process failed'
    }, 500);
  }
});

export default app;