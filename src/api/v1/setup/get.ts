import { Context } from 'hono';
import { ConfigService } from '../../../services/config';
import type { Env } from '../../../types';
import type { SetupStatusResponse, SetupErrorResponse } from './types';
import { constantTimeEquals } from '../../../utils/security';

/**
 * Setup API endpoint - returns setup status information
 * 
 * Security model:
 * - Setup incomplete: Free access with config values for initial setup
 * - Setup complete + authenticated: Config values returned for re-setup
 * - Setup complete + unauthenticated: Config flags only for security
 */
export const setupGetHandler = async (c: Context<{ Bindings: Env }>) => {
  try {
    // セットアップ状態の確認
    const isSetupCompleted = ConfigService.getBoolean('app.setup_completed', false);
    
    // 認証の確認（セットアップ完了時のみ）
    let isAuthenticated = true; // セットアップ未完了時はデフォルトで認証済み扱い
    
    if (isSetupCompleted) {
      const authHeader = c.req.header('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      const storedPassword = ConfigService.getString('app.config_password');
      
      isAuthenticated = !!(token && constantTimeEquals(token, storedPassword || ''));
      
      if (!isAuthenticated) {
        return c.json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authorization header with Bearer token required for setup information access'
          }
        }, 401);
      }
    }

    // 必須フィールドの定義
    const requiredFields = [
      'google.client_id',
      'google.client_secret',
      'auth0.domain',
      'auth0.client_id',
      'auth0.client_secret',
      'app.config_password'
    ];

    // 完了済みフィールドの計算
    const completedFields = requiredFields.filter(field => {
      const value = ConfigService.getString(field);
      return value && value.trim() !== '';
    });

    // 進捗の計算
    const completedSteps = completedFields.length;
    const totalSteps = requiredFields.length;
    const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    // 次のステップの決定
    const nextSteps: string[] = [];
    if (!ConfigService.getString('google.client_id')) {
      nextSteps.push('Configure Google OAuth credentials');
    }
    if (!ConfigService.getString('auth0.domain')) {
      nextSteps.push('Configure Auth0 settings');
    }
    if (!ConfigService.getString('app.config_password')) {
      nextSteps.push('Set configuration password');
    }
    if (nextSteps.length === 0 && !isSetupCompleted) {
      nextSteps.push('Complete setup process');
    }

    // 設定情報の取得（認証状態に応じて）
    let currentConfig: SetupStatusResponse['setup']['currentConfig'];

    if (!isSetupCompleted || isAuthenticated) {
      // セットアップ未完了時 OR 認証済み時：実際の値を返す
      currentConfig = {
        google: {
          clientId: ConfigService.getString('google.client_id') || undefined,
          clientSecret: ConfigService.getString('google.client_secret') || undefined,
        },
        auth0: {
          domain: ConfigService.getString('auth0.domain') || undefined,
          clientId: ConfigService.getString('auth0.client_id') || undefined,
          clientSecret: ConfigService.getString('auth0.client_secret') || undefined,
        },
      };
    } else {
      // セットアップ完了時かつ未認証：フラグのみ
      currentConfig = {
        hasGoogleCredentials: !!(ConfigService.getString('google.client_id') && 
                                 ConfigService.getString('google.client_secret')),
        hasAuth0Config: !!(ConfigService.getString('auth0.domain') && 
                          ConfigService.getString('auth0.client_id')),
      };
    }

    const response: SetupStatusResponse = {
      setup: {
        isCompleted: isSetupCompleted,
        requiredFields,
        completedFields,
        currentConfig,
        nextSteps,
        progress: {
          percentage,
          completedSteps,
          totalSteps
        }
      },
      timestamp: new Date().toISOString()
    };

    return c.json(response);

  } catch (error) {
    console.error('Setup API error:', error);
    return c.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve setup information'
      }
    }, 500);
  }
};