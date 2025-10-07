# 詳細設計書 - Google シートバックエンド REST API サービス

## 1. アーキテクチャ概要

### 1.1 システム構成図

```
┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐
│   React Admin   │    │   Hono API       │    │  Google Sheets │
│   Management    │◄──►│   Server         │◄──►│   Data Source  │
│   Dashboard     │    │  (Workers)       │    │                │
└─────────────────┘    └──────────────────┘    └────────────────┘
                                │                        │
                                ▼                        │
                       ┌──────────────────┐              │
                       │  Cloudflare D1   │              │
                       │  Cache Database  │              │
                       └──────────────────┘              │
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌────────────────┐
                       │  Cloudflare R2   │    │ Google Drive   │
                       │  File Storage    │    │ File Storage   │
                       └──────────────────┘    └────────────────┘
```

### 1.2 技術スタック

- **言語**: TypeScript 5.x
- **フレームワーク**: 
  - バックエンド: Hono 4.x
  - フロントエンド: React 18.x + Vite
- **データベース**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **ランタイム**: Cloudflare Workers
- **認証**:
  - 管理者: Google OAuth2 + JWT
  - ユーザー: Google Sheets _Userシート認証 + JWT
- **ファイルストレージ**: Cloudflare R2 / Google Drive API
- **テスト**: Vitest + @cloudflare/vitest-pool-workers

## 2. コンポーネント設計

### 2.1 コンポーネント一覧

| コンポーネント名 | 責務 | 依存関係 |
|---|---|---|
| `api-server` | API エンドポイント処理 | `auth-service`, `cache-service`, `sheets-service` |
| `auth-service` | 認証・認可処理 | `database-client`, `jwt-utils` |
| `cache-service` | キャッシュ管理 | `database-client`, `background-queue` |
| `sheets-service` | Google Sheets API 連携 | `google-client`, `acl-service` |
| `acl-service` | アクセス制御 | `auth-service`, `database-client` |
| `file-service` | ファイル管理 | `storage-client`, `acl-service` |
| `admin-dashboard` | 管理画面 | `api-client` |
| `database-client` | D1 データベース操作 | `drizzle-orm` |
| `google-client` | Google API クライアント | None |
| `storage-client` | ファイルストレージクライアント | None |

### 2.2 各コンポーネントの詳細

#### api-server

- **目的**: HTTP リクエストの受信と適切なサービスへのルーティング
- **公開インターフェース**:
  ```typescript
  interface ApiServer {
    // REST API エンドポイント
    get(path: string): Promise<Response>;
    post(path: string, body: unknown): Promise<Response>;
    put(path: string, body: unknown): Promise<Response>;
    delete(path: string): Promise<Response>;
  }
  ```
- **内部実装方針**: Hono フレームワークを使用し、ミドルウェアで認証・CORS・レート制限を実装

#### auth-service

- **目的**: 2パターンの認証処理とJWT トークン管理
- **公開インターフェース**:
  ```typescript
  interface AuthService {
    // 認証・認可
    verifyToken(token: string): Promise<User | null>;
    authenticateUser(credentials: {username: string; password: string}): Promise<AuthResult>;
    getUserRoles(userId: string): Promise<Role[]>;
    hasPermission(user: User, resource: string, action: string): Promise<boolean>;

    // 初期設定用（Google OAuth2でシート選択）
    setupGoogleAuth(googleToken: string): Promise<{sheets: Sheet[]}>;
    selectSheet(sheetId: string): Promise<void>;
  }
  ```
- **内部実装方針**:
  - 認証: _UsersシートのID/PWを検証後、_Rolesシートでロール確認してJWT 発行
  - 初期設定: Google OAuth2でシート選択のみ（管理者認証ではない）

#### cache-service

- **目的**: Google Sheets API レスポンスのキャッシュ管理
- **公開インターフェース**:
  ```typescript
  interface CacheService {
    get(sheetName: string): Promise<CacheEntry | null>;
    set(sheetName: string, value: unknown, ttl?: number): Promise<void>;
    invalidateSheet(sheetName: string): Promise<void>;
    refreshInBackground(sheetNames: string[]): Promise<void>;
  }
  ```
- **内部実装方針**: D1 を使用し、TTL 管理とバックグラウンド更新機能を実装

#### sheets-service

- **目的**: Google Sheets API との連携とデータ操作
- **公開インターフェース**:
  ```typescript
  interface SheetsService {
    getSheetData(sheetName: string): Promise<SheetData[]>;
    getRowByObjectId(sheetName: string, objectId: string): Promise<SheetData | null>;
    updateRow(sheetName: string, objectId: string, data: Record<string, unknown>): Promise<void>;
    appendRow(sheetName: string, data: Record<string, unknown>): Promise<void>;
    deleteRow(sheetName: string, objectId: string): Promise<void>;

    // カラム設定の取得
    getColumnDefinitions(sheetName: string): Promise<ColumnDefinition[]>;
    validateData(sheetName: string, data: Record<string, unknown>): Promise<ValidationResult>;
  }
  ```
- **内部実装方針**:
  - Google Sheets API v4 を使用
  - 2行目のカラム設定を解析してバリデーション
  - `_`で始まるカラムは API レスポンスから除外

#### acl-service

- **目的**: 行レベルアクセス制御の実装
- **公開インターフェース**:
  ```typescript
  interface AclService {
    checkRowPermission(user: User, row: SheetRow, action: AclAction): Promise<boolean>;
    filterRowsByPermission(user: User, rows: SheetRow[], action: AclAction): Promise<SheetRow[]>;
  }
  
  type AclAction = 'read' | 'write';

  interface AclSettings {
    public_read: boolean;
    public_write: boolean;
    users_read: string[];   // ユーザーIDの配列
    users_write: string[];  // ユーザーIDの配列
    roles_read: string[];   // ロールIDの配列
    roles_write: string[];  // ロールIDの配列
  }
  ```
- **内部実装方針**: 各行のACL設定を評価し、ユーザーの権限と照合

## 3. データフロー

### 3.1 データフロー図

```
[Client Request] 
    ↓
[API Server] → [Auth Service] → [ACL Service]
    ↓              ↓               ↓
[Cache Service] ← [Sheets Service] ← [Google Sheets API]
    ↓
[D1 Database]
    ↓
[Response to Client]
```

### 3.2 キャッシュ戦略

- **GET リクエスト**: キャッシュファーストアプローチ
  1. D1 キャッシュをチェック
  2. ヒット時は即座にレスポンス
  3. ミス時は Google Sheets から取得してキャッシュ

- **POST/PUT/DELETE リクエスト**: ライトスルーアプローチ
  1. Google Sheets を直接更新
  2. 成功時にキャッシュを無効化
  3. バックグラウンドでキャッシュを再構築

## 4. データベース設計

### 4.1 D1 テーブル構造

```sql
-- キャッシュテーブル
CREATE TABLE cache_entries (
  sheet_name TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  ttl INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- ユーザーセッションテーブル
CREATE TABLE user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- APIレート制限テーブル
CREATE TABLE rate_limits (
  client_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  window_start INTEGER NOT NULL,
  PRIMARY KEY (client_id, endpoint)
);

-- 設定テーブル
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);
```

### 4.2 Google Sheets 構造

#### シート共通仕様
- **1行目**: カラム名（`_`で始まるカラムは非公開）
- **2行目**: カラム設定（JSON形式）
  ```json
  {
    "required": true,           // 必須
    "unique": true,             // ユニーク
    "pattern": "^[A-Z0-9]+$",  // 入力パターン（正規表現）
    "max": 100,                 // 最大値
    "min": 0,                   // 最小値
    "length": 10,               // 桁数
    "type": "string"            // 型
  }
  ```
- **型の種類**: `string`, `number`, `date`, `boolean`, `url`, `email`, `array`, `json`
- **3行目以降**: データ行

#### _Users シート（ユーザー認証用）
```
行1: | object_id | username | _password_hash | email | name | status | created_at |
行2: | {"type":"string","unique":true} | {"type":"string","unique":true,"required":true} | {"type":"string","required":true} | {"type":"email","unique":true} | {"type":"string"} | {"type":"string"} | {"type":"date"} |
行3: | u001 | admin | $2b$10$... | admin@example.com | Admin User | active | 2024-01-01 |
```

#### _Roles シート（ロール管理）
```
行1: | object_id | name | users | created_at |
行2: | {"type":"string","unique":true} | {"type":"string","unique":true,"required":true} | {"type":"array"} | {"type":"date"} |
行3: | r001 | admin | ["u001","u002"] | 2024-01-01 |
```

#### _Files シート（ファイルメタデータ）
```
行1: | object_id | original_name | storage_provider | storage_path | content_type | size_bytes | owner_id | public_read | public_write | users_read | users_write | roles_read | roles_write | created_at |
行2: | {"type":"string","unique":true} | {"type":"string","required":true} | {"type":"string","pattern":"^(r2|google_drive)$"} | {"type":"string"} | {"type":"string"} | {"type":"number","min":0} | {"type":"string"} | {"type":"boolean"} | {"type":"boolean"} | {"type":"array"} | {"type":"array"} | {"type":"array"} | {"type":"array"} | {"type":"date"} |
```

#### データシート（例: Products）
```
行1: | object_id | name | price | _internal_note | public_read | public_write | users_read | users_write | roles_read | roles_write | created_by | updated_at |
行2: | {"type":"string","unique":true} | {"type":"string","required":true} | {"type":"number","min":0} | {"type":"string"} | {"type":"boolean"} | {"type":"boolean"} | {"type":"array"} | {"type":"array"} | {"type":"array"} | {"type":"array"} | {"type":"string"} | {"type":"date"} |
行3: | p001 | Product A | 1000 | 内部メモ | true | false | [] | [] | ["r001"] | ["r001"] | u001 | 2024-01-01 |
```

## 5. API インターフェース

### 5.1 REST API エンドポイント

```typescript
// データ操作 API（シート名ベース）
GET    /api/sheets/{sheetName}
POST   /api/sheets/{sheetName}
PUT    /api/sheets/{sheetName}/{objectId}
DELETE /api/sheets/{sheetName}/{objectId}

// 認証 API
POST   /api/auth/login          // ID/PW 認証（_Usersシート参照）
POST   /api/auth/refresh        // トークン更新
POST   /api/auth/logout         // ログアウト

// 初期設定 API（Google認証でシート選択）
POST   /api/setup/google-auth   // Google OAuth2でシート選択
GET    /api/setup/sheets        // 利用可能なシート一覧取得
POST   /api/setup/select-sheet  // シートを選択して設定保存

// ファイル管理 API
POST   /api/files/upload
GET    /api/files/{fileId}
DELETE /api/files/{fileId}

// 管理 API
GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/cache/stats
POST   /api/admin/cache/invalidate
```

### 5.2 レスポンス形式

```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    page?: number;
    cache_hit?: boolean;
  };
}
```

## 6. エラーハンドリング

### 6.1 エラー分類

- **認証エラー**: 401 Unauthorized
- **認可エラー**: 403 Forbidden  
- **バリデーションエラー**: 400 Bad Request
- **リソース不存在**: 404 Not Found
- **レート制限**: 429 Too Many Requests
- **外部API エラー**: 502 Bad Gateway
- **内部エラー**: 500 Internal Server Error

### 6.2 エラーレスポンス例

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: "AUTHENTICATION_FAILED" | "PERMISSION_DENIED" | "VALIDATION_ERROR";
    message: string;
    details?: {
      field?: string;
      value?: unknown;
      constraint?: string;
    };
  };
}
```

## 7. セキュリティ設計

### 7.1 認証・認可フロー

#### 認証フロー
```
1. ユーザーログイン → _Usersシート ID/PW 検証 → user_id取得
2. _Rolesシートでuser_idを含むロールを検索
3. ロールに応じたJWT 発行（roles: ['admin', 'user', ...]）
```

#### 初期設定フロー（Google認証）
```
1. 初回セットアップ → Google OAuth2 → Googleアカウント認証
2. Google Drive/Sheets API でシート一覧取得
3. 対象シート選択 → SHEET_ID をD1 configテーブルに保存
4. サービスアカウントに権限付与
```

### 7.2 セキュリティ対策

- **SQL インジェクション**: Drizzle ORM のパラメータ化クエリ
- **XSS**: Content Security Policy + エスケープ処理
- **CORS**: 許可されたオリジンのみアクセス許可
- **レート制限**: IP アドレス + API キー単位での制限
- **データ暗号化**: JWT + HTTPS 通信

## 8. テスト戦略

### 8.1 テスト構成

```
tests/
├── unit/           # 単体テスト（各サービス）
├── integration/    # 統合テスト（API エンドポイント）
├── e2e/           # E2E テスト（管理画面）
└── fixtures/      # テストデータ
```

### 8.2 テスト実装方針

- **単体テスト**: サービス層の各メソッドをテスト
- **統合テスト**: 実際の D1 データベースを使用
- **E2E テスト**: 実際の Google Sheets を使用
- **カバレッジ**: 80% 以上を目標
- **モック禁止**: 実環境でのテストを実施

## 9. パフォーマンス最適化

### 9.1 キャッシュ最適化

- **TTL 設定**: データの変更頻度に応じた TTL
- **プリウォーミング**: よくアクセスされるデータの事前キャッシュ
- **バックグラウンド更新**: キャッシュ期限前の自動更新

### 9.2 API 最適化

- **バッチ処理**: 複数行の一括処理
- **圧縮**: gzip 圧縮による転送量削減
- **接続プール**: Google API クライアントの再利用

## 10. デプロイメント

### 10.1 Cloudflare Workers デプロイ

```yaml
# wrangler.toml
name = "sheet-db-api"
main = "src/index.ts"
compatibility_date = "2024-10-01"

[env.production]
database_id = "your-d1-database-id"
r2_bucket = "your-r2-bucket"

[[env.production.bindings]]
name = "DB"
type = "d1"
database_id = "your-d1-database-id"
```

### 10.2 環境変数管理

```typescript
interface Env {
  // Cloudflare バインディング
  DB: D1Database;
  R2_BUCKET: R2Bucket;

  // 環境変数
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  SHEET_ID: string; // Google Sheets のID
}
```

## 11. ファイル構成

### 11.1 プロジェクト構造

```
src/
├── api/
│   ├── routes/         # API ルート定義
│   ├── middleware/     # 認証・CORS ミドルウェア
│   └── handlers/       # リクエストハンドラー
├── services/
│   ├── auth.ts         # 認証サービス
│   ├── cache.ts        # キャッシュサービス
│   ├── sheets.ts       # Sheets サービス
│   ├── acl.ts         # ACL サービス
│   └── files.ts       # ファイルサービス
├── clients/
│   ├── database.ts     # D1 クライアント
│   ├── google.ts      # Google API クライアント
│   └── storage.ts     # R2/Drive クライアント
├── types/
│   ├── api.ts         # API 型定義
│   ├── database.ts    # DB 型定義
│   └── sheets.ts      # Sheets 型定義
├── utils/
│   ├── jwt.ts         # JWT ユーティリティ
│   ├── validation.ts  # バリデーション
│   └── errors.ts      # エラー定義
└── admin/
    ├── components/    # React コンポーネント
    ├── pages/        # ページコンポーネント
    ├── hooks/        # カスタムフック
    └── services/     # API クライアント
```

## 12. 実装上の注意事項

### 12.1 Cloudflare Workers 制約

- **実行時間**: 最大30秒（CPU時間は10ms〜50ms）
- **メモリ**: 128MB 制限
- **レスポンスサイズ**: 100MB 制限
- **同時接続**: 1000 リクエスト/分

### 12.2 Google Sheets API 制約

- **レート制限**: 100 リクエスト/100秒/ユーザー
- **バッチサイズ**: 最大 1000 行
- **セルサイズ**: 最大 50,000 文字

### 12.3 開発上の注意

- **各ファイル300行以下**: 機能を適切に分割
- **フォールバック禁止**: エラー時は明確な失敗を返す
- **モック禁止**: 実際のサービスを使用したテスト
- **型安全性**: TypeScript strict モードを使用

### 12.4 継続的デプロイメント

- **自動テスト**: プルリクエスト時の自動テスト実行
- **段階的デプロイ**: staging → production 環境
- **ロールバック**: 問題発生時の即座の巻き戻し
- **モニタリング**: エラー率・レスポンス時間の監視