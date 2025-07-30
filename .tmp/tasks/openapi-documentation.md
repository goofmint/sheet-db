# OpenAPI Documentation

## 現在のAPIエンドポイント一覧

### API Routes (/api/v1/*)

#### Health
- `GET /api/v1/health` - Check API health status
  - レスポンス: { status: 'ok', timestamp: string, version: string }

#### Setup
- `GET /api/v1/setup` - Get setup status
  - レスポンス: { isSetupCompleted: boolean, requiredFields: string[] }
- `POST /api/v1/setup` - Submit setup configuration
  - リクエスト: 設定項目のkey-valueペア + csrf_token
  - レスポンス: { success: boolean, message: string }

#### Sheets
- `POST /api/v1/sheets` - Create or initialize sheets
  - リクエスト: { name: string, headers?: string[] }
  - レスポンス: { id: string, name: string, url: string }

#### Storage
- `POST /api/v1/storages` - Create/upload file
  - リクエスト: multipart/form-data (file + path)
  - レスポンス: { id: string, url: string, path: string, size: number }
- `DELETE /api/v1/storages/:id` - Delete file
  - パラメータ: id (string)
  - レスポンス: { success: boolean, message: string }

#### Playground
- `GET /api/v1/playground` - Show API playground
  - レスポンス: HTMLページ

#### Auth
- `GET /api/v1/auth/login` - Initiate login (Auth0)
- `GET /api/v1/auth/callback` - OAuth callback
- `POST /api/v1/auth/logout` - Logout user
- `GET /api/v1/auth/me` - Get current user
  - レスポンス: { id: string, email: string, name: string, picture?: string }

### Web Routes (Non-API)

#### Root
- `GET /` - Root path (redirects to /setup or /playground)

#### Static Files
- `GET /statics/*` - Static file serving (CSS, JS assets)

#### Google OAuth
- `GET /google/callback` - Google OAuth callback

#### Sheet Management
- `GET /sheet/select` - Sheet selection page
- `POST /sheet/select` - Handle sheet selection
- `GET /sheet/initialize` - Sheet initialization page  
- `POST /sheet/initialize` - Handle sheet initialization

#### Setup & Playground
- `GET /setup` - Setup page
- `GET /playground` - API playground page

#### Configuration Management
- `GET /config` - Configuration management page
- `GET /config/auth` - Configuration authentication
- `POST /config/logout` - Configuration logout

## OpenAPI実装方針

### 利用ライブラリ
- `@hono/zod-openapi` (既にインストール済み)
- `@hono/swagger-ui` (既にインストール済み)

### ルーティング構造案
```typescript
import { describeRoute } from 'hono-openapi';
```

### 対象エンドポイント
- **Priority 1**: API routes (`/api/v1/*`) - 8エンドポイント
- **Priority 2**: Web routes (必要に応じて)

### ドキュメント公開場所
- OpenAPI JSON: `/api/v1/doc`
- Swagger UI: `/api/v1/ui`

### スキーマ定義が必要な項目
1. **Health Check**: 基本的なヘルスチェック応答
2. **Setup**: 設定項目の定義とバリデーション
3. **Sheets**: Google Sheets操作のリクエスト/レスポンス
4. **Storage**: ファイルアップロード/削除の仕様
5. **Auth**: 認証関連のユーザー情報
6. **Playground**: HTMLレスポンス（簡易）

### 実装ステップ
1. 基本的なOpenAPIルーター作成
2. 各エンドポイントのスキーマ定義
3. 既存ルーターとの統合
4. Swagger UIの設定
5. テストとドキュメント確認