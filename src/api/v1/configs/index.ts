import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { getConfigsListRoute } from './route';
import { ConfigService } from '../../../services/config';
import { AuthService } from '../../../services/auth';
import type { Env } from '../../../types/env';

const app = new OpenAPIHono<{ Bindings: Env }>();

export { getConfigsListRoute };

/**
 * 設定管理認証チェック
 * 認証されたユーザーのみ設定にアクセスできる
 */
async function checkConfigAuthentication(c: Context<{ Bindings: Env }>): Promise<boolean> {
  try {
    const authService = new AuthService(c.env);
    const auth = await authService.getAuthFromRequest(c);
    return auth !== null;
  } catch (error) {
    console.error('Config authentication check failed:', error);
    return false;
  }
}

app.openapi(getConfigsListRoute, async (c) => {
  try {
    // 認証チェック
    const isAuthenticated = await checkConfigAuthentication(c);
    if (!isAuthenticated) {
      return c.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, 401);
    }

    // バリデーション済みクエリパラメータの取得
    const { page, limit, search, type, system, sort, order } = c.req.valid('query');

    // 設定項目の取得
    const result = await ConfigService.getConfigsList({
      page, limit, search, type, system, sort, order
    });
    
    // validationフィールドのパースと system_config の boolean 変換
    const configs = result.configs.map(config => ({
      ...config,
      system_config: config.system_config === 1, // int to boolean
      validation: (() => {
        try {
          return config.validation ? JSON.parse(config.validation) : null;
        } catch {
          return null;
        }
      })()
    }));

    return c.json({
      success: true,
      data: {
        configs,
        pagination: result.pagination
      }
    });

  } catch (error) {
    console.error('Get configs list error:', error);
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve configuration list'
      }
    }, 500);
  }
});

export default app;
export { app as configsRouter };