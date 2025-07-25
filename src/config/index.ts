import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { configTable } from '../db/schema';
import type { Config, DatabaseConfig } from '../types/config';
import type { Env } from '../types/env';

// メモリキャッシュ
let cachedDatabaseConfig: DatabaseConfig | null = null;
let configLoadPromise: Promise<DatabaseConfig> | null = null;

/**
 * JSON文字列を安全にパースし、失敗時はデフォルト値を返す
 */
function safeJsonParse<T>(value: string, defaultValue: T): T {
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

/**
 * 環境変数からアプリケーション基本設定を取得
 */
export function getAppConfig(env: Env): Config {
  return {
    environment: 'production', // Cloudflare Workersでは本番環境として扱う
    logLevel: (env.LOG_LEVEL as Config['logLevel']) || 'info',
    corsOrigins: ['*'], // デフォルト値
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    requestTimeout: 30000, // 30秒
  };
}

/**
 * Configテーブルから設定を一括読み込み
 */
export async function loadConfig(env: Env): Promise<DatabaseConfig> {
  // 既にロード中の場合はそのPromiseを返す（競合状態対処）
  if (configLoadPromise) {
    return configLoadPromise;
  }

  // キャッシュが存在する場合は返す
  if (cachedDatabaseConfig) {
    return cachedDatabaseConfig;
  }

  // 新しいロードPromiseを作成
  configLoadPromise = loadConfigFromDatabase(env);

  try {
    const config = await configLoadPromise;
    cachedDatabaseConfig = config;
    return config;
  } finally {
    // ロード完了後はPromiseをクリア
    configLoadPromise = null;
  }
}

/**
 * データベースから実際に設定を読み込む内部関数
 */
async function loadConfigFromDatabase(env: Env): Promise<DatabaseConfig> {
  const db = drizzle(env.DB);
  
  try {
    const configEntries = await db.select().from(configTable);
    
    const config: DatabaseConfig = {
      setupCompleted: false,
      cacheExpiration: 600, // デフォルト10分
      allowCreateTable: false,
      allowModifyTable: false,
      allowDeleteTable: false,
      allowCreateUsers: [],
      allowCreateRoles: [],
      allowModifyUsers: [],
      allowModifyRoles: [],
      allowDeleteUsers: [],
      allowDeleteRoles: [],
    };

    // 設定値を解析してconfigオブジェクトに設定
    for (const entry of configEntries) {
      const key = entry.name;
      const value = entry.value;

      switch (key) {
        case 'googleClientId':
          config.googleClientId = value;
          break;
        case 'googleClientSecret':
          config.googleClientSecret = value;
          break;
        case 'googleAccessTokens':
          config.googleAccessTokens = safeJsonParse(value, []);
          break;
        case 'spreadsheetId':
          config.spreadsheetId = value;
          break;
        case 'spreadsheetName':
          config.spreadsheetName = value;
          break;
        case 'spreadsheetUrl':
          config.spreadsheetUrl = value;
          break;
        case 'masterKey':
          config.masterKey = value;
          break;
        case 'configPassword':
          config.configPassword = value;
          break;
        case 'auth0Domain':
          config.auth0Domain = value;
          break;
        case 'auth0ClientId':
          config.auth0ClientId = value;
          break;
        case 'auth0ClientSecret':
          config.auth0ClientSecret = value;
          break;
        case 'setupCompleted':
          config.setupCompleted = value === 'true';
          break;
        case 'sheetSetupStatus':
          config.sheetSetupStatus = value;
          break;
        case 'sheetsInitialized':
          config.sheetsInitialized = value === 'true';
          break;
        case 'sheetSetupProgress':
          config.sheetSetupProgress = value;
          break;
        case 'uploadDestination':
          config.uploadDestination = value as 'r2' | 'google_drive';
          break;
        case 'googleDriveFolderId':
          config.googleDriveFolderId = value;
          break;
        case 'cacheExpiration':
          const cacheExp = parseInt(value, 10);
          config.cacheExpiration = isNaN(cacheExp) ? 600 : cacheExp;
          break;
        case 'allowCreateTable':
          config.allowCreateTable = value === 'true';
          break;
        case 'allowModifyTable':
          config.allowModifyTable = value === 'true';
          break;
        case 'allowDeleteTable':
          config.allowDeleteTable = value === 'true';
          break;
        case 'allowCreateUsers':
          config.allowCreateUsers = safeJsonParse(value, []);
          break;
        case 'allowCreateRoles':
          config.allowCreateRoles = safeJsonParse(value, []);
          break;
        case 'allowModifyUsers':
          config.allowModifyUsers = safeJsonParse(value, []);
          break;
        case 'allowModifyRoles':
          config.allowModifyRoles = safeJsonParse(value, []);
          break;
        case 'allowDeleteUsers':
          config.allowDeleteUsers = safeJsonParse(value, []);
          break;
        case 'allowDeleteRoles':
          config.allowDeleteRoles = safeJsonParse(value, []);
          break;
      }
    }

    return config;
  } catch (error) {
    // Configテーブルが存在しない場合やエラーの場合はデフォルト設定を返す
    return {
      setupCompleted: false,
      cacheExpiration: 600,
      allowCreateTable: false,
      allowModifyTable: false,
      allowDeleteTable: false,
      allowCreateUsers: [],
      allowCreateRoles: [],
      allowModifyUsers: [],
      allowModifyRoles: [],
      allowDeleteUsers: [],
      allowDeleteRoles: [],
    };
  }
}

/**
 * キャッシュされた設定を取得（ロード済みでない場合はエラー）
 */
export function getDatabaseConfig(): DatabaseConfig {
  if (!cachedDatabaseConfig) {
    throw new Error('Database configuration not loaded. Call loadConfig() first or ensure middleware is properly set up.');
  }
  return cachedDatabaseConfig;
}

/**
 * キャッシュをクリア（テスト用）
 */
export function clearConfigCache(): void {
  cachedDatabaseConfig = null;
  configLoadPromise = null;
}

/**
 * 設定ロードのミドルウェア
 */
export function configMiddleware(env: Env) {
  return async (c: any, next: () => Promise<void>) => {
    // 設定がロードされていない場合は待機
    if (configLoadPromise) {
      await configLoadPromise;
    } else if (!cachedDatabaseConfig) {
      await loadConfig(env);
    }
    
    await next();
  };
}