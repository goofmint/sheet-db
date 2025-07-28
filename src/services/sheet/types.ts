import { Env } from '../../types/env';

/**
 * Google Sheets操作のための汎用インターフェース
 * シートの作成、読み取り、更新、削除操作を提供
 */

export interface SheetRow {
  [key: string]: string | number | boolean | null;
}

export interface SheetCreateOptions {
  sheetName: string;
  data: SheetRow;
  acl?: SheetACL;
}

export interface SheetUpdateOptions {
  sheetName: string;
  filter: {
    column: string;
    value: string | number | boolean;
  };
  data: Partial<SheetRow>;
}

export interface SheetFindOptions {
  sheetName: string;
  filter?: {
    column: string;
    value: string | number | boolean;
  };
  limit?: number;
}

export interface SheetACL {
  public_read: boolean;
  public_write: boolean;
  read_users: string[];
  write_users: string[];
}

export interface SheetOperationResult {
  success: boolean;
  data?: SheetRow | SheetRow[];
  error?: string;
  rowIndex?: number;
}

/**
 * Google Sheetsサービスの抽象インターフェース
 */
export interface ISheetService {
  /**
   * シートに新しい行を作成
   */
  create(env: Env, options: SheetCreateOptions): Promise<SheetOperationResult>;

  /**
   * シートから行を検索
   */
  find(env: Env, options: SheetFindOptions): Promise<SheetOperationResult>;

  /**
   * シートの行を更新
   */
  update(env: Env, options: SheetUpdateOptions): Promise<SheetOperationResult>;

  /**
   * シートから行を削除
   */
  delete(env: Env, sheetName: string, filter: { column: string; value: string | number | boolean }): Promise<SheetOperationResult>;

  /**
   * シートが存在するかチェック
   */
  exists(env: Env, sheetName: string): Promise<boolean>;

  /**
   * シートを作成（ヘッダー付き）
   */
  createSheet(env: Env, sheetName: string, headers: string[], acl?: SheetACL): Promise<SheetOperationResult>;
}

/**
 * デフォルトのACL設定
 */
export const DEFAULT_ACL: SheetACL = {
  public_read: true,
  public_write: false,
  read_users: [],
  write_users: []
};

/**
 * _UserシートのACL設定（プライベート）
 */
export const USER_SHEET_ACL: SheetACL = {
  public_read: false,
  public_write: false,
  read_users: [], // 実行時に設定
  write_users: [] // 実行時に設定
};

/**
 * _Userシートのヘッダー定義
 */
export const USER_SHEET_HEADERS = [
  'auth0_id',
  'email', 
  'name',
  'picture',
  'created_at',
  'last_login'
];

/**
 * ユーザー専用のACL設定を生成
 */
export function createUserACL(userId: string): SheetACL {
  return {
    public_read: false,
    public_write: false,
    read_users: [userId],
    write_users: [userId]
  };
}

/**
 * ユーザーデータ型定義
 */
export interface UserSheetData {
  auth0_id: string;
  email: string;
  name: string;
  picture: string;
  created_at: string;
  last_login: string;
}