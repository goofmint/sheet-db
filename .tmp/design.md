# 技術設計書 - GoogleシートバックエンドAPIサービス「sheetDB」

## 1. システムアーキテクチャ

### 1.1 全体構成

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Client Apps    │────▶│ Cloudflare      │────▶│ Google Sheets   │
│  (REST API)     │     │ Workers         │     │ API             │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                        ┌────────┴────────┐
                        │                 │
                   ┌────▼────┐      ┌────▼────────────┐
                   │ D1 DB   │      │ File Storage   │
                   │ (Cache) │      │ (R2 / Drive)   │
                   └─────────┘      └────────────────┘
```

### 1.2 レイヤー構成

```
┌─────────────────────────────────────────┐
│           API Layer (Hono)              │
├─────────────────────────────────────────┤
│         Middleware Layer                │
│  (Auth, Validation, Error Handling)     │
├─────────────────────────────────────────┤
│         Service Layer                   │
│  (Business Logic, Cache Strategy)       │
├─────────────────────────────────────────┤
│         Repository Layer                │
│  (D1, Google Sheets, R2, Drive)        │
└─────────────────────────────────────────┘
```

## 2. データベース設計

### 2.1 D1データベース（SQLite）

#### Configテーブル
```sql
CREATE TABLE Config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    value_type TEXT DEFAULT 'string',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 主要な設定項目
-- google_client_id, google_client_secret
-- google_access_tokens (JSON配列)
-- spreadsheet_id, spreadsheet_name, spreadsheet_url
-- auth0_domain, auth0_client_id, auth0_client_secret
-- cache_expiration (デフォルト: 600秒)
-- allow_create_table, allow_modify_table, allow_delete_table
-- allow_create_users, allow_create_roles (JSON配列)
```

#### Cacheテーブル
```sql
CREATE TABLE Cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL, -- 正規化されたURL（クエリパラメータをソート）
    data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    INDEX idx_cache_expires_at (expires_at)
);
```

#### Sessionテーブル
```sql
CREATE TABLE Session (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    auth0_sub TEXT NOT NULL,
    email TEXT,
    roles TEXT, -- JSON配列
    permissions TEXT, -- JSON配列
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_user_id (user_id),
    INDEX idx_session_expires_at (expires_at)
);
```

### 2.2 Google Sheets スキーマ

#### デフォルトシート構造
```
行1（ヘッダー）: id, created_at, updated_at, public_read, public_write, user_read, user_write, role_read, role_write, [カスタムフィールド...]
行2（スキーマ）: string|required|unique, timestamp|default:CURRENT_TIMESTAMP, timestamp|default:CURRENT_TIMESTAMP, boolean|default:true, boolean|default:false, string[]|default:[], string[]|default:[], string[]|default:[], string[]|default:[], [カスタムフィールド定義...]
行3以降: データ行
```

#### 予約シート
- **users**: ユーザー管理（id, email, name, roles, created_at, updated_at）
- **roles**: ロール管理（id, name, description, permissions, created_at, updated_at）

## 3. API設計

### 3.1 エンドポイント構造

```
GET    /                           # Setup or Playground redirect
GET    /setup                      # Setup page
POST   /setup                      # Setup configuration
GET    /playground                 # API test interface
GET    /health                     # Health check
GET    /docs                       # OpenAPI documentation

# Sheet API
GET    /api/sheets                 # List sheets
POST   /api/sheets                 # Create sheet
GET    /api/sheets/{sheetName}    # Get sheet data
PUT    /api/sheets/{sheetName}    # Update sheet
DELETE /api/sheets/{sheetName}    # Delete sheet

# Data API
GET    /api/sheets/{sheetName}/data      # Query data
POST   /api/sheets/{sheetName}/data      # Create record
GET    /api/sheets/{sheetName}/data/{id} # Get record
PUT    /api/sheets/{sheetName}/data/{id} # Update record
DELETE /api/sheets/{sheetName}/data/{id} # Delete record

# Schema API
GET    /api/sheets/{sheetName}/schema    # Get schema
PUT    /api/sheets/{sheetName}/schema    # Update schema

# File API
POST   /api/files/upload           # Upload file
GET    /api/files/{fileId}         # Download file
DELETE /api/files/{fileId}         # Delete file

# Auth API
GET    /api/auth/login             # Login redirect
GET    /api/auth/callback          # Auth0 callback
POST   /api/auth/logout            # Logout
GET    /api/auth/me                # Current user info
```

### 3.2 認証・認可フロー

```
1. APIリクエスト受信
   ├─▶ 公開データチェック
   │   └─▶ public_read/write = true なら認証不要でアクセス許可
   └─▶ 非公開データの場合
       └─▶ 認証チェック → 未認証なら401 Unauthorized

2. Auth0ログイン
   ├─▶ /api/auth/login
   ├─▶ Auth0認証画面
   └─▶ /api/auth/callback → Session作成

3. 認証済みリクエスト
   ├─▶ Authorizationヘッダー検証
   ├─▶ Session検証
   └─▶ 権限チェック（ACL）

4. ACL権限チェック（優先順位）
   ├─▶ public_read/write チェック（true なら誰でもアクセス可）
   ├─▶ user_read/write チェック（ユーザーIDが含まれているか）
   └─▶ role_read/write チェック（ユーザーのロールが含まれているか）
   
5. 権限判定結果
   ├─▶ アクセス許可 → データ返却/操作実行
   └─▶ アクセス拒否 → 403 Forbidden
```

## 4. キャッシュ戦略

### 4.1 読み取り処理

```typescript
async function readData(request: Request) {
  // 1. URLを正規化（クエリパラメータをソート）
  const normalizedUrl = normalizeUrl(request.url);
  
  // 2. キャッシュチェック
  const cached = await cache.get(normalizedUrl);
  if (cached && !isExpired(cached)) {
    return cached.data;
  }
  
  // 3. キャッシュミスまたは期限切れ
  if (cached && isExpired(cached)) {
    // バックグラウンド更新をトリガー
    ctx.waitUntil(refreshCache(normalizedUrl));
    return cached.data; // 古いデータを返す
  }
  
  // 4. Google Sheetsから取得
  const data = await googleSheets.read(request);
  await cache.set(normalizedUrl, data);
  return data;
}

// URL正規化関数
function normalizeUrl(url: string): string {
  const urlObj = new URL(url);
  const params = new URLSearchParams(urlObj.search);
  const sortedParams = new URLSearchParams([...params].sort());
  urlObj.search = sortedParams.toString();
  return urlObj.toString();
}
```

### 4.2 書き込み処理

```typescript
async function writeData(request: Request, sheetName: string, data: any) {
  // 1. Google Sheetsに直接書き込み
  const result = await googleSheets.write(sheetName, data);
  
  // 2. バックグラウンドでシート関連のキャッシュを無効化
  // URLパターンに基づいて関連するキャッシュエントリを削除
  ctx.waitUntil(invalidateCacheByPattern(`/api/sheets/${sheetName}`));
  
  return result;
}
```

## 5. エラーハンドリング

### 5.1 エラーレスポンス形式

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  path: string;
  requestId: string;
}
```

### 5.2 HTTPステータスコード

- 200: 成功
- 201: 作成成功
- 400: 不正なリクエスト
- 401: 認証エラー
- 403: 権限エラー
- 404: リソースが見つからない
- 409: 競合エラー
- 429: レート制限
- 500: サーバーエラー
- 503: サービス一時停止

## 6. セキュリティ設計

### 6.1 認証

- Auth0によるOAuth2.0/OIDC認証
- JWTトークンによるセッション管理
- リフレッシュトークンの安全な管理

### 6.2 認可

- 行レベルのACL（Access Control List）
- マスターキーによる管理者権限
- ロール・ユーザーベースのアクセス制御（RBAC）
- API キーによるマシン間通信

### 6.3 データ保護

- HTTPS通信の強制
- 機密データの暗号化
- SQLインジェクション対策
- XSS対策

## 7. パフォーマンス最適化

### 7.1 キャッシュ

- D1によるデータキャッシュ
- キャッシュの自動無効化
- バックグラウンド更新

### 7.2 クエリ最適化

- インデックスの活用
- ページネーション
- 部分読み込み

### 7.3 レート制限

- Google Sheets API制限への対応
- Auth0のレート制限対応
- リトライ機構

## 8. デプロイメント構成

### 8.1 環境

- 開発環境: wrangler dev
- ステージング環境: Cloudflare Workers (preview)
- 本番環境: Cloudflare Workers (production)

### 8.2 CI/CD

```yaml
# GitHub Actions workflow
- テスト実行
- 型チェック
- ビルド
- デプロイ（環境別）
```

## 9. モニタリング・ログ

### 9.1 ログ構造

```typescript
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  requestId: string;
  userId?: string;
  metadata?: Record<string, any>;
}
```

### 9.2 メトリクス

- API応答時間
- エラー率
- キャッシュヒット率
- Google Sheets API使用率

## 10. 実装優先順位

### Phase 1: 基盤構築
1. プロジェクト構造のセットアップ
2. D1データベーススキーマの実装
3. 基本的なAPIルーティング
4. エラーハンドリング基盤

### Phase 2: 認証・認可
1. Auth0統合
2. セッション管理
3. ACL実装

### Phase 3: Google Sheets統合
1. Google Sheets API連携
2. データ読み書き機能
3. スキーマ管理

### Phase 4: キャッシュ・最適化
1. キャッシュ機構の実装
2. バックグラウンド更新
3. パフォーマンス最適化

### Phase 5: 拡張機能
1. ファイルアップロード（R2/Google Drive）
2. OpenAPI仕様書生成
3. Playground UI

## 11. ファイルストレージ設計

### 11.1 ストレージ選択

Configテーブルの`upload_destination`設定により、以下のストレージを選択：

- **r2**: Cloudflare R2 Storage
- **google_drive**: Google Drive

### 11.2 ファイルメタデータ管理

Google Sheetsの専用シート（`_File`）でファイル情報を管理：

```
行1（ヘッダー）: id, filename, original_name, mime_type, size, storage_type, storage_path, uploaded_by, uploaded_at, public_read, user_read, role_read
行2（スキーマ）: string|required|unique, string|required, string|required, string|required, number|required, string|required, string|required, string|required, timestamp|default:CURRENT_TIMESTAMP, boolean|default:false, string[]|default:[], string[]|default:[]
```

### 11.3 ストレージ実装

#### R2 Storage
```typescript
interface R2FileStorage {
  upload(file: File, metadata: FileMetadata): Promise<string>;
  download(fileId: string): Promise<Response>;
  delete(fileId: string): Promise<void>;
}
```

#### Google Drive Storage
```typescript
interface GoogleDriveStorage {
  upload(file: File, metadata: FileMetadata): Promise<string>;
  download(fileId: string): Promise<Response>;
  delete(fileId: string): Promise<void>;
  // Google Drive固有のフォルダID設定を使用
  folderId: string; // Configテーブルのgoogle_drive_folder_idから取得
}
```

### 11.4 アクセス制御

ファイルへのアクセスは、`_File`シートの行レベルACLで制御：
- public_read: 誰でもダウンロード可能
- user_read: 指定ユーザーのみダウンロード可能
- role_read: 指定ロールのみダウンロード可能

