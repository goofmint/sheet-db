import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { Context } from 'hono';
import { getAppConfig, loadConfig, getDatabaseConfig, clearConfigCache, configMiddleware } from '../../src/config/index';
import { configTable } from '../../src/db/schema';
import type { Env } from '../../src/types/env';

describe('Config Management', () => {
  let testEnv: Env;

  beforeAll(async () => {
    // テスト開始前にConfigテーブルを一度だけ作成
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS Config (id INTEGER PRIMARY KEY, name TEXT, value TEXT)`);
  });

  beforeEach(async () => {
    // テスト前にキャッシュをクリア
    clearConfigCache();
    
    testEnv = {
      DB: env.DB,
      LOG_LEVEL: 'debug',
    };

    // テスト用のConfigテーブルをクリア
    const db = drizzle(testEnv.DB);
    await db.delete(configTable);
  });

  afterEach(async () => {
    // テスト後にキャッシュをクリア
    clearConfigCache();
    
    // テスト後のConfigテーブルをクリア
    if (testEnv?.DB) {
      const db = drizzle(testEnv.DB);
      await db.delete(configTable);
    }
  });

  describe('getAppConfig', () => {
    it('環境変数から基本設定を取得する', () => {
      const config = getAppConfig(testEnv);
      
      expect(config).toEqual({
        environment: 'production',
        logLevel: 'debug',
        corsOrigins: ['*'],
        maxRequestSize: 10 * 1024 * 1024,
        requestTimeout: 30000,
      });
    });

    it('LOG_LEVELが未設定の場合はデフォルト値を使用する', () => {
      const envWithoutLogLevel: Env = {
        DB: testEnv.DB,
      };
      
      const config = getAppConfig(envWithoutLogLevel);
      expect(config.logLevel).toBe('info');
    });
  });

  describe('loadConfig', () => {
    it('Configテーブルから設定を読み込む', async () => {
      // テスト用データを挿入
      const db = drizzle(testEnv.DB);
      await db.insert(configTable).values([
        { name: 'setupCompleted', value: 'true' },
        { name: 'cacheExpiration', value: '300' },
        { name: 'allowCreateTable', value: 'true' },
        { name: 'googleClientId', value: 'test-client-id' },
        { name: 'spreadsheetId', value: 'test-sheet-id' },
        { name: 'allowCreateUsers', value: '["admin", "user"]' },
        { name: 'googleAccessTokens', value: '[{"token": "test-token", "expiresAt": "2024-12-31", "scope": "spreadsheets"}]' },
      ]);

      const config = await loadConfig(testEnv);
      
      expect(config.setupCompleted).toBe(true);
      expect(config.cacheExpiration).toBe(300);
      expect(config.allowCreateTable).toBe(true);
      expect(config.googleClientId).toBe('test-client-id');
      expect(config.spreadsheetId).toBe('test-sheet-id');
      expect(config.allowCreateUsers).toEqual(['admin', 'user']);
      expect(config.googleAccessTokens).toEqual([{
        token: 'test-token',
        expiresAt: '2024-12-31',
        scope: 'spreadsheets'
      }]);
    });

    it('設定値の型変換が正しく行われる', async () => {
      // テスト用データを挿入
      const db = drizzle(testEnv.DB);
      await db.insert(configTable).values([
        { name: 'setupCompleted', value: 'true' },
        { name: 'cacheExpiration', value: '300' },
        { name: 'allowCreateTable', value: 'false' },
        { name: 'allowCreateUsers', value: '["test1", "test2"]' },
        { name: 'googleAccessTokens', value: '[{"token": "test-token", "expiresAt": "2024-12-31", "scope": "spreadsheets"}]' },
      ]);

      const config = await loadConfig(testEnv);
      
      // boolean型の変換
      expect(typeof config.setupCompleted).toBe('boolean');
      expect(typeof config.allowCreateTable).toBe('boolean');
      expect(config.setupCompleted).toBe(true);
      expect(config.allowCreateTable).toBe(false);
      
      // number型の変換
      expect(typeof config.cacheExpiration).toBe('number');
      expect(config.cacheExpiration).toBe(300);
      
      // JSON配列の変換
      expect(Array.isArray(config.allowCreateUsers)).toBe(true);
      expect(Array.isArray(config.googleAccessTokens)).toBe(true);
      expect(config.allowCreateUsers).toEqual(['test1', 'test2']);
    });

    it('デフォルト値が正しく設定される', async () => {
      // 空のデータベース（設定エントリなし）でテスト
      const config = await loadConfig(testEnv);
      
      expect(config.setupCompleted).toBe(false);
      expect(config.cacheExpiration).toBe(600);
      expect(config.allowCreateTable).toBe(false);
      expect(config.allowModifyTable).toBe(false);
      expect(config.allowDeleteTable).toBe(false);
      expect(config.allowCreateUsers).toEqual([]);
      expect(config.allowCreateRoles).toEqual([]);
    });

    it('重複ロードを防ぐ（競合状態対処）', async () => {
      // テスト用データを挿入
      const db = drizzle(testEnv.DB);
      await db.insert(configTable).values([
        { name: 'setupCompleted', value: 'true' },
        { name: 'googleClientId', value: 'test-client-id' },
        { name: 'cacheExpiration', value: '300' },
      ]);

      // 同時に複数回loadConfigを呼び出し
      const [config1, config2, config3] = await Promise.all([
        loadConfig(testEnv),
        loadConfig(testEnv),
        loadConfig(testEnv)
      ]);

      // すべて同じ結果が返される
      expect(config1).toEqual(config2);
      expect(config2).toEqual(config3);
      expect(config1.setupCompleted).toBe(true);
      expect(config1.googleClientId).toBe('test-client-id');
      expect(config1.cacheExpiration).toBe(300);
    });

    it('キャッシュされた設定を再利用する', async () => {
      // テスト用データを挿入
      const db = drizzle(testEnv.DB);
      await db.insert(configTable).values([
        { name: 'setupCompleted', value: 'true' },
        { name: 'spreadsheetId', value: 'test-sheet-id' },
      ]);

      // 最初のロード
      const config1 = await loadConfig(testEnv);
      
      // 2回目のロード（キャッシュから取得されるべき）
      const config2 = await loadConfig(testEnv);

      expect(config1).toEqual(config2);
      expect(config1.setupCompleted).toBe(true);
      expect(config1.spreadsheetId).toBe('test-sheet-id');
    });
  });

  describe('getDatabaseConfig', () => {
    it('キャッシュされた設定を取得する', async () => {
      // テスト用データを挿入
      const db = drizzle(testEnv.DB);
      await db.insert(configTable).values([
        { name: 'setupCompleted', value: 'true' },
        { name: 'googleClientId', value: 'test-client-id' },
      ]);

      // 先に設定をロード
      await loadConfig(testEnv);
      
      const config = getDatabaseConfig();
      expect(config.setupCompleted).toBe(true);
      expect(config.googleClientId).toBe('test-client-id');
    });

    it('設定が未ロードの場合はエラーを投げる', () => {
      expect(() => getDatabaseConfig()).toThrow('Database configuration not loaded. Call loadConfig() first or ensure middleware is properly set up.');
    });
  });

  describe('configMiddleware', () => {
    it('設定をロードしてから次の処理に進む', async () => {
      // テスト用データを挿入
      const db = drizzle(testEnv.DB);
      await db.insert(configTable).values([
        { name: 'setupCompleted', value: 'true' },
        { name: 'cacheExpiration', value: '600' },
      ]);

      let nextCalled = false;
      const nextMock = async () => {
        nextCalled = true;
      };
      const contextMock = {} as Context;
      
      const middleware = configMiddleware(testEnv);
      await middleware(contextMock, nextMock);
      
      expect(nextCalled).toBe(true);
      // 設定がロードされていることを確認
      expect(() => getDatabaseConfig()).not.toThrow();
      expect(getDatabaseConfig().setupCompleted).toBe(true);
    });

    it('設定が既にロード中の場合は待機する', async () => {
      // テスト用データを挿入
      const db = drizzle(testEnv.DB);
      await db.insert(configTable).values([
        { name: 'setupCompleted', value: 'false' },
        { name: 'cacheExpiration', value: '300' },
      ]);

      let nextCalled = false;
      const nextMock = async () => {
        nextCalled = true;
      };
      const contextMock = {} as Context;
      
      // 設定ロードを開始（完了を待たない）
      const loadPromise = loadConfig(testEnv);
      
      const middleware = configMiddleware(testEnv);
      await middleware(contextMock, nextMock);
      
      // ロードが完了するまで待機
      await loadPromise;
      
      expect(nextCalled).toBe(true);
      expect(() => getDatabaseConfig()).not.toThrow();
      expect(getDatabaseConfig().setupCompleted).toBe(false);
    });
  });

  describe('clearConfigCache', () => {
    it('キャッシュをクリアする', async () => {
      // テスト用データを挿入して設定をロード
      const db = drizzle(testEnv.DB);
      await db.insert(configTable).values([
        { name: 'setupCompleted', value: 'true' },
      ]);

      await loadConfig(testEnv);
      expect(() => getDatabaseConfig()).not.toThrow();
      
      // キャッシュをクリア
      clearConfigCache();
      expect(() => getDatabaseConfig()).toThrow();
    });
  });
});