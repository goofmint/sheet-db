import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import { Env } from '@/types/env';

const app = new Hono<{ Bindings: Env }>();

// パスワード認証
app.post('/', async (c) => {
  try {
    // ConfigServiceを初期化
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }

    // Try both formData and parseBody for better compatibility
    let password: string;
    try {
      const body = await c.req.parseBody();
      password = body.password as string;
    } catch {
      const formData = await c.req.formData();
      password = formData.get('password') as string;
    }

    if (!password) {
      return c.redirect('/config?error=password_required');
    }

    // 設定パスワードを取得
    const configPassword = ConfigService.getString('app.config_password');
    
    if (!configPassword) {
      return c.redirect('/config?error=config_not_found');
    }

    // パスワード照合（定数時間比較）
    const isValid = await comparePasswords(password, configPassword);
    
    if (!isValid) {
      // タイミング攻撃対策: 一定時間待機
      await new Promise(resolve => setTimeout(resolve, 100));
      return c.redirect('/config?error=invalid_password');
    }

    // 認証成功: Cookieを設定
    setCookie(c, 'config_auth', 'authenticated', {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === 'https:',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 2, // 2時間
      path: '/'
    });

    return c.redirect('/config');

  } catch (error) {
    console.error('Config auth error:', error);
    return c.redirect('/config?error=server_error');
  }
});

// 定数時間でのパスワード比較
async function comparePasswords(input: string, stored: string): Promise<boolean> {
  // 単純な文字列比較（本来はハッシュ化されたパスワードと比較すべき）
  if (input.length !== stored.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < input.length; i++) {
    result |= input.charCodeAt(i) ^ stored.charCodeAt(i);
  }
  
  return result === 0;
}

export default app;