import { Hono } from 'hono';
import { ConfigService } from '../../../services/config';
import { checkConfigAuthentication } from '../../../utils/auth';
import type { Env } from '../../../types/env';

const app = new Hono<{ Bindings: Env }>();

// GET /api/v1/configs/:id - 個別の設定項目取得
app.get('/:id', async (c) => {
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
    const id = c.req.param('id');
    
    // IDはkeyとして扱う（RESTful API設計に従う）
    const config = ConfigService.findByKey(id);
    
    if (!config) {
      return c.json({
        success: false,
        error: {
          code: 'NOT_FOUND' as const,
          message: `Configuration with key '${id}' not found`
        }
      }, 404);
    }
    
    // レスポンスデータの構築
    const responseData = {
      key: config.key,
      value: config.value,
      type: config.type as 'string' | 'boolean' | 'number' | 'json',
      description: config.description,
      system_config: config.system_config === 1,
      validation: (() => {
        try {
          return config.validation ? JSON.parse(config.validation) : null;
        } catch {
          return null;
        }
      })(),
      created_at: config.created_at,
      updated_at: config.updated_at
    };

    return c.json({
      success: true,
      data: responseData
    }, 200);

  } catch (error) {
    console.error('Get config by id error:', error);
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR' as const,
        message: 'Failed to retrieve configuration'
      }
    }, 500);
  }
});

export default app;
export { app as configGetRouter };