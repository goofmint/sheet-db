import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAppConfig, loadConfig, getDatabaseConfig, clearConfigCache, configMiddleware } from '../../src/config/index';
import type { Env } from '../../src/types/env';
import type { DatabaseConfig } from '../../src/types/config';

// モックのD1データベース
const mockD1 = {
  prepare: vi.fn(),
  dump: vi.fn(),
  batch: vi.fn(),
  exec: vi.fn(),
};

// モックのDrizzleクエリ結果
const mockConfigEntries = [
  { name: 'setupCompleted', value: 'true' },
  { name: 'cacheExpiration', value: '300' },
  { name: 'allowCreateTable', value: 'true' },
  { name: 'googleClientId', value: 'test-client-id' },
  { name: 'spreadsheetId', value: 'test-sheet-id' },
  { name: 'allowCreateUsers', value: '["admin", "user"]' },
  { name: 'googleAccessTokens', value: '[{"token": "test-token", "expiresAt": "2024-12-31", "scope": "spreadsheets"}]' },
];

// drizzle-ormのモック
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => Promise.resolve(mockConfigEntries))
    }))
  }))
}));

describe('Config Management', () => {
  let mockEnv: Env;

  beforeEach(() => {
    // テスト前にキャッシュをクリア
    clearConfigCache();
    
    mockEnv = {
      DB: mockD1 as any,
      LOG_LEVEL: 'debug',
    };

    // モックをリセット
    vi.clearAllMocks();
  });

  describe('getAppConfig', () => {
    it('環境変数から基本設定を取得する', () => {
      const config = getAppConfig(mockEnv);
      
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
        DB: mockD1 as any,
      };
      
      const config = getAppConfig(envWithoutLogLevel);
      expect(config.logLevel).toBe('info');
    });
  });

  describe('loadConfig', () => {
    it('Configテーブルから設定を読み込む', async () => {
      const config = await loadConfig(mockEnv);
      
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
      const config = await loadConfig(mockEnv);
      
      // boolean型の変換
      expect(typeof config.setupCompleted).toBe('boolean');
      expect(typeof config.allowCreateTable).toBe('boolean');
      
      // number型の変換
      expect(typeof config.cacheExpiration).toBe('number');
      
      // JSON配列の変換
      expect(Array.isArray(config.allowCreateUsers)).toBe(true);
      expect(Array.isArray(config.googleAccessTokens)).toBe(true);
    });

    it('デフォルト値が正しく設定される', async () => {
      // 空の設定エントリでテスト
      const { drizzle } = await import('drizzle-orm/d1');
      vi.mocked(drizzle).mockReturnValue({
        select: vi.fn(() => ({
          from: vi.fn(() => Promise.resolve([]))
        }))
      } as any);

      const config = await loadConfig(mockEnv);
      
      expect(config.setupCompleted).toBe(false);
      expect(config.cacheExpiration).toBe(600);
      expect(config.allowCreateTable).toBe(false);
      expect(config.allowModifyTable).toBe(false);
      expect(config.allowDeleteTable).toBe(false);
      expect(config.allowCreateUsers).toEqual([]);
      expect(config.allowCreateRoles).toEqual([]);
    });

    it('データベースエラーの場合はデフォルト設定を返す', async () => {
      // データベースエラーを発生させる
      const { drizzle } = await import('drizzle-orm/d1');
      vi.mocked(drizzle).mockReturnValue({
        select: vi.fn(() => ({
          from: vi.fn(() => Promise.reject(new Error('Database error')))
        }))
      } as any);

      const config = await loadConfig(mockEnv);
      
      expect(config.setupCompleted).toBe(false);
      expect(config.cacheExpiration).toBe(600);
    });

    it('重複ロードを防ぐ（競合状態対処）', async () => {
      const { drizzle } = await import('drizzle-orm/d1');
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => Promise.resolve(mockConfigEntries))
      }));
      vi.mocked(drizzle).mockReturnValue({
        select: mockSelect
      } as any);

      // 同時に複数回loadConfigを呼び出し
      const [config1, config2, config3] = await Promise.all([
        loadConfig(mockEnv),
        loadConfig(mockEnv),
        loadConfig(mockEnv)
      ]);

      // すべて同じ結果が返される
      expect(config1).toEqual(config2);
      expect(config2).toEqual(config3);
      
      // データベースアクセスは1回のみ
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });

    it('キャッシュされた設定を再利用する', async () => {
      const { drizzle } = await import('drizzle-orm/d1');
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => Promise.resolve(mockConfigEntries))
      }));
      vi.mocked(drizzle).mockReturnValue({
        select: mockSelect
      } as any);

      // 最初のロード
      const config1 = await loadConfig(mockEnv);
      
      // 2回目のロード（キャッシュから取得）
      const config2 = await loadConfig(mockEnv);

      expect(config1).toEqual(config2);
      // データベースアクセスは1回のみ
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDatabaseConfig', () => {
    it('キャッシュされた設定を取得する', async () => {
      // 先に設定をロード
      await loadConfig(mockEnv);
      
      const config = getDatabaseConfig();
      expect(config.setupCompleted).toBe(true);
    });

    it('設定が未ロードの場合はエラーを投げる', () => {
      expect(() => getDatabaseConfig()).toThrow('Database configuration not loaded. Call loadConfig() first or ensure middleware is properly set up.');
    });
  });

  describe('configMiddleware', () => {
    it('設定をロードしてから次の処理に進む', async () => {
      const nextMock = vi.fn();
      const contextMock = {};
      
      const middleware = configMiddleware(mockEnv);
      await middleware(contextMock, nextMock);
      
      expect(nextMock).toHaveBeenCalled();
      // 設定がロードされていることを確認
      expect(() => getDatabaseConfig()).not.toThrow();
    });

    it('設定が既にロード中の場合は待機する', async () => {
      const nextMock = vi.fn();
      const contextMock = {};
      
      // 設定ロードを開始（完了を待たない）
      const loadPromise = loadConfig(mockEnv);
      
      const middleware = configMiddleware(mockEnv);
      await middleware(contextMock, nextMock);
      
      // ロードが完了するまで待機
      await loadPromise;
      
      expect(nextMock).toHaveBeenCalled();
      expect(() => getDatabaseConfig()).not.toThrow();
    });
  });

  describe('clearConfigCache', () => {
    it('キャッシュをクリアする', async () => {
      // 設定をロード
      await loadConfig(mockEnv);
      expect(() => getDatabaseConfig()).not.toThrow();
      
      // キャッシュをクリア
      clearConfigCache();
      expect(() => getDatabaseConfig()).toThrow();
    });
  });
});