import type { Context } from 'hono';
import type { Env } from '../../../types/env';
import { ConfigService } from '../../../services/config';
import { checkConfigAuthentication } from '../../../utils/auth';
import { ConfigValidator } from '../../../services/config/validation';

export const deleteConfigHandler = async (c: Context<{ Bindings: Env }>) => {
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

    // パラメータの取得とバリデーション
    const key = c.req.param('key');
    
    try {
      ConfigValidator.validateKey(key);
    } catch (error) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid configuration key format'
        }
      }, 400);
    }

    // 設定の存在確認
    const existingConfig = ConfigService.findByKey(key);
    if (!existingConfig) {
      return c.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Configuration with key '${key}' not found`
        }
      }, 404);
    }

    // システム設定の削除禁止チェック
    if (existingConfig.system_config) {
      return c.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Cannot delete system configuration '${key}'`
        }
      }, 403);
    }

    // 削除禁止設定のチェック
    const protectedKeys = [
      'app.config_password',
      'google.client_id',
      'google.client_secret'
    ];

    if (protectedKeys.includes(key)) {
      return c.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Cannot delete system configuration '${key}'`
        }
      }, 403);
    }

    // 設定の削除
    const deleted = await ConfigService.deleteByKey(key);
    if (!deleted) {
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete configuration'
        }
      }, 500);
    }

    return c.json({
      success: true,
      data: {
        message: `Configuration '${key}' deleted successfully`,
        deleted_key: key
      }
    }, 200);

  } catch (error) {
    console.error('Delete config error:', error);
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete configuration'
      }
    }, 500);
  }
};