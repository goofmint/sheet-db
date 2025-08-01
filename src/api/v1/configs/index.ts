import { Hono } from 'hono';
import { ConfigService } from '../../../services/config';
import { checkConfigAuthentication } from '../../../utils/auth';
import type { Env } from '../../../types/env';
import type { Config, ConfigType } from '../../../db/schema';

const app = new Hono<{ Bindings: Env }>();

// Convert config value based on type for proper response typing
function convertConfigValue(value: string, type: ConfigType): string | number | boolean | Record<string, unknown> {
  switch (type) {
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'number':
      const num = Number(value);
      return isNaN(num) ? value : num;
    case 'json':
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return value;
      }
    case 'string':
    default:
      return value;
  }
}

// GET /api/v1/configs - Configuration list retrieval
app.get('/', async (c) => {
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
    // クエリパラメータの取得とバリデーション
    const pageParam = c.req.query('page');
    const limitParam = c.req.query('limit');
    const typeParam = c.req.query('type');
    const sortParam = c.req.query('sort');
    const orderParam = c.req.query('order');
    
    // ページ番号のバリデーション
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    if (page < 1) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR' as const,
          message: 'Page must be greater than 0'
        }
      }, 400);
    }
    
    // 制限数のバリデーション
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    if (limit < 1) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR' as const,
          message: 'Limit must be greater than 0'
        }
      }, 400);
    }
    const finalLimit = Math.min(limit, 100);
    
    const search = c.req.query('search') || '';
    
    // 型フィルタのバリデーション
    let type: 'string' | 'boolean' | 'number' | 'json' | undefined;
    if (typeParam) {
      if (!['string', 'boolean', 'number', 'json'].includes(typeParam)) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR' as const,
            message: 'Invalid type filter'
          }
        }, 400);
      }
      type = typeParam as 'string' | 'boolean' | 'number' | 'json';
    }
    
    const system = c.req.query('system') ? c.req.query('system') === 'true' : undefined;
    
    // ソート項目のバリデーション
    let sort: 'key' | 'type' | 'created_at' | 'updated_at' = 'key';
    if (sortParam) {
      if (!['key', 'type', 'created_at', 'updated_at'].includes(sortParam)) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR' as const,
            message: 'Invalid sort field'
          }
        }, 400);
      }
      sort = sortParam as 'key' | 'type' | 'created_at' | 'updated_at';
    }
    
    // ソート順のバリデーション
    let order: 'asc' | 'desc' = 'asc';
    if (orderParam) {
      if (!['asc', 'desc'].includes(orderParam)) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR' as const,
            message: 'Invalid sort order'
          }
        }, 400);
      }
      order = orderParam as 'asc' | 'desc';
    }

    // 設定項目の取得
    const result = await ConfigService.getConfigsList({
      page, limit: finalLimit, search, type, system, sort, order
    });
    
    // Parse validation field and convert system_config to boolean, exclude id
    const configs = result.configs.map((config: Config) => ({
      key: config.key,
      value: convertConfigValue(config.value, config.type),
      type: config.type,
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
