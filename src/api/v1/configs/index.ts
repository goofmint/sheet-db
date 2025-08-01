import { OpenAPIHono } from '@hono/zod-openapi';
import { Context } from 'hono';
import { getConfigsListRoute } from './route';
import { ConfigService } from '../../../services/config';
import { checkConfigAuthentication } from '../../../utils/auth';
import type { Env } from '../../../types/env';

const app = new OpenAPIHono<{ Bindings: Env }>();

export { getConfigsListRoute };

app.openapi(getConfigsListRoute, async (c) => {
  // 認証チェック
  const isAuthenticated = await checkConfigAuthentication(c);
  if (!isAuthenticated) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED' as const,
        message: 'Authentication required'
      }
    }, 401);
  }

  try {
    // バリデーション済みクエリパラメータの取得
    const { page, limit, search, type, system, sort, order } = c.req.valid('query');

    // 設定項目の取得
    const result = await ConfigService.getConfigsList({
      page, limit, search, type, system, sort, order
    });
    
    // validationフィールドのパースと system_config の boolean 変換、id除外
    const configs = result.configs.map(config => ({
      key: config.key,
      value: config.value,
      type: config.type as 'string' | 'boolean' | 'number' | 'json',
      description: config.description,
      system_config: config.system_config === 1, // int to boolean
      validation: (() => {
        try {
          return config.validation ? JSON.parse(config.validation) : null;
        } catch {
          return null;
        }
      })(),
      created_at: config.created_at,
      updated_at: config.updated_at
    }));

    return c.json({
      success: true,
      data: {
        configs,
        pagination: result.pagination
      }
    }, 200);

  } catch (error) {
    console.error('Get configs list error:', error);
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR' as const,
        message: 'Failed to retrieve configuration list'
      }
    }, 500);
  }
});


export default app;
export { app as configsRouter };
