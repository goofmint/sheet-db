import { Hono } from 'hono';
import { getCookie, deleteCookie } from 'hono/cookie';
import { AuthService } from '@/services/auth';
import { Env } from '@/types/env';

const app = new Hono<{ Bindings: Env }>();

app.post('/', async (c) => {
  try {
    const sessionId = getCookie(c, 'session_id');
    
    if (sessionId) {
      // セッションをデータベースから削除
      const authService = new AuthService(c.env);
      await authService.logout(sessionId);
    }
    
    // セッションクッキーを削除
    deleteCookie(c, 'session_id');
    
    return c.json({
      success: true,
      message: 'Logout successful',
      authenticated: false
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    
    return c.json({
      success: false,
      error: 'logout_failed',
      message: 'Failed to logout',
      authenticated: true
    }, 500);
  }
});

export default app;