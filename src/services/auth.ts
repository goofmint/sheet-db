import { getCookie } from 'hono/cookie';
import { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { SessionRepository } from '@/repositories/session';
import type { Env } from '@/types/env';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthSession {
  session_id: string;
  user: AuthUser;
  expires_at: string;
  access_token?: string;
}

/**
 * 認証サービス
 */
export class AuthService {
  private sessionRepo: SessionRepository;

  constructor(env: Env) {
    const db = drizzle(env.DB);
    this.sessionRepo = new SessionRepository(db);
  }

  /**
   * リクエストから認証情報を取得
   */
  async getAuthFromRequest(c: Context): Promise<AuthSession | null> {
    const sessionId = getCookie(c, 'session_id');
    if (!sessionId) return null;

    return await this.getAuthBySessionId(sessionId);
  }

  /**
   * セッションIDから認証情報を取得
   */
  async getAuthBySessionId(sessionId: string): Promise<AuthSession | null> {
    const session = await this.sessionRepo.findValidBySessionId(sessionId);
    if (!session) return null;

    try {
      const userData = JSON.parse(session.user_data);
      return {
        session_id: session.session_id,
        user: {
          id: userData.sub || session.user_id,
          email: userData.email,
          name: userData.name,
          picture: userData.picture
        },
        expires_at: session.expires_at,
        access_token: session.access_token || undefined
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * セッションを削除（ログアウト）
   */
  async logout(sessionId: string): Promise<boolean> {
    return await this.sessionRepo.deleteBySessionId(sessionId);
  }

  /**
   * 認証が必要なAPIのミドルウェア
   */
  static requireAuth() {
    return async (c: Context, next: Function) => {
      const authService = new AuthService(c.env);
      const auth = await authService.getAuthFromRequest(c);
      
      if (!auth) {
        return c.json({
          success: false,
          error: 'unauthorized',
          message: 'Authentication required'
        }, 401);
      }

      // コンテキストに認証情報を保存
      c.set('auth', auth);
      await next();
    };
  }
}