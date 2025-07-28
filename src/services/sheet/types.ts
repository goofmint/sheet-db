
/**
 * Google Sheets操作のための汎用インターフェース
 * シートの作成、読み取り、更新、削除操作を提供
 */

export interface SheetRow {
  [key: string]: string | number | boolean | null | string[];
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
  user_read: string[];
  user_write: string[];
  role_read: string[];
  role_write: string[];
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
  create(options: SheetCreateOptions): Promise<SheetOperationResult>;

  /**
   * シートから行を検索
   */
  find(options: SheetFindOptions): Promise<SheetOperationResult>;

  /**
   * シートの行を更新
   */
  update(options: SheetUpdateOptions): Promise<SheetOperationResult>;

  /**
   * シートから行を削除
   */
  delete(sheetName: string, filter: { column: string; value: string | number | boolean }): Promise<SheetOperationResult>;

  /**
   * シートが存在するかチェック
   */
  exists(sheetName: string): Promise<boolean>;

  /**
   * シートを作成（ヘッダー付き）
   */
  createSheet(sheetName: string, headers: string[], acl?: SheetACL): Promise<SheetOperationResult>;
}

/**
 * デフォルトのACL設定
 */
export const DEFAULT_ACL: SheetACL = {
  public_read: true,
  public_write: false,
  user_read: [],
  user_write: [],
  role_read: [],
  role_write: []
};

/**
 * _UserシートのACL設定（プライベート）
 */
export const USER_SHEET_ACL: SheetACL = {
  public_read: false,
  public_write: false,
  user_read: [], // 実行時に設定
  user_write: [], // 実行時に設定
  role_read: [],
  role_write: []
};

/**
 * _Userシートのヘッダー定義
 */
export const USER_SHEET_HEADERS = [
  'id',
  'email', 
  'name',
  'picture',
  'created_at',
  'last_login',
  'public_read',
  'public_write',
  'user_read',
  'user_write',
  'role_read',
  'role_write'
];

/**
 * ユーザー専用のACL設定を生成
 */
export function createUserACL(userId: string): SheetACL {
  return {
    public_read: false,
    public_write: false,
    user_read: [userId],
    user_write: [userId],
    role_read: [],
    role_write: []
  };
}

/**
 * ユーザーデータ型定義
 */
export interface UserSheetData {
  id: string; // auth0_idをidにマッピング
  email: string;
  name: string;
  picture: string;
  created_at: string;
  last_login: string;
}