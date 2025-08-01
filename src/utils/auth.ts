/**
 * 認証ユーティリティ
 */

import { Context } from 'hono';
import { ConfigService } from '../services/config';
import { constantTimeEquals } from './security';

/**
 * 設定管理用の認証チェック
 * app.config_passwordトークンを使用した認証を行う
 */
export async function checkConfigAuthentication(c: Context<any>): Promise<boolean> {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const storedPassword = ConfigService.getString('app.config_password');
  
  // storedPasswordが設定されていない場合は認証失敗
  if (!storedPassword) {
    return false;
  }
  
  // トークンが提供されていない場合は認証失敗
  if (!token) {
    return false;
  }
  
  // 定数時間比較で認証
  return constantTimeEquals(token, storedPassword);
}

/**
 * セットアップ完了状態をチェック
 */
export function isSetupCompleted(): boolean {
  return !!ConfigService.getString('app.config_password');
}