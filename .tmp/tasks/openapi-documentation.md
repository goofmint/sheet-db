# OpenAPI Documentation

## 対象エンドポイント: /api/v1/* のみ

### API Routes (/api/v1/*)

#### Standard Error Schema
```json
{
  "error": "string",
  "message": "string", 
  "code": "string (optional)",
  "details": "array (optional)"
}
```

#### Health
- `GET /api/v1/health` - Check API health status
  - **200** (application/json): { status: 'ok', timestamp: string, version: string }
  - **500** (application/json): Standard error schema

#### Setup
- `GET /api/v1/setup` - Get setup status
  - **200** (application/json): { isSetupCompleted: boolean, requiredFields: string[] }
  - **500** (application/json): Standard error schema

- `POST /api/v1/setup` - Submit setup configuration
  - **Request** (application/json): 設定項目のkey-valueペア + csrf_token
  - **200** (application/json): { success: boolean, message: string }
  - **400** (application/json): Standard error schema (validation errors)
  - **403** (application/json): Standard error schema (CSRF token invalid)
  - **500** (application/json): Standard error schema

#### Sheets
- `POST /api/v1/sheets` - Create or initialize sheets
  - **Request** (application/json): { name: string, headers?: string[] }
  - **201** (application/json): { id: string, name: string, url: string }
  - **400** (application/json): Standard error schema (validation errors)
  - **401** (application/json): Standard error schema (authentication required)
  - **500** (application/json): Standard error schema

#### Storage
- `POST /api/v1/storages` - Create/upload file
  - **Request** (multipart/form-data): file + path (optional)
  - **201** (application/json): { id: string, url: string, path: string, size: number }
  - **400** (application/json): Standard error schema (no file or validation errors)
  - **401** (application/json): Standard error schema (authentication required)
  - **413** (application/json): Standard error schema (file too large)
  - **500** (application/json): Standard error schema

- `DELETE /api/v1/storages/{id}` - Delete file
  - **Path Parameters**: id (string)
  - **200** (application/json): { success: boolean, message: string }
  - **401** (application/json): Standard error schema (authentication required)
  - **404** (application/json): Standard error schema (file not found)
  - **500** (application/json): Standard error schema

#### Playground
- `GET /api/v1/playground` - Show API playground
  - **200** (text/html): HTMLページ
  - **500** (application/json): Standard error schema

#### Auth
**Security Scheme**: OAuth2 Authorization Code Flow with Auth0
- **Flow**: authorizationCode
- **Authorization URL**: https://{domain}.auth0.com/authorize
- **Token URL**: https://{domain}.auth0.com/oauth/token
- **Scopes**: openid, profile, email
- **Cookies**: Used for session management after successful authentication

- `GET /api/v1/auth/login` - Initiate Auth0 login
  - **302** (text/html): Redirect to Auth0 authorization endpoint
  - **500** (application/json): Standard error schema

- `GET /api/v1/auth/callback` - OAuth callback from Auth0
  - **Query Parameters**: code, state
  - **302** (text/html): Redirect to application after successful login
  - **400** (application/json): Standard error schema (invalid code/state)
  - **500** (application/json): Standard error schema

- `POST /api/v1/auth/logout` - Logout user
  - **200** (application/json): { success: boolean, message: string }
  - **302** (text/html): Redirect to logout page (alternative response)
  - **500** (application/json): Standard error schema

- `GET /api/v1/auth/me` - Get current user information
  - **200** (application/json): { id: string, email: string, name: string, picture?: string }
  - **401** (application/json): Standard error schema (not authenticated)
  - **500** (application/json): Standard error schema

## OpenAPI実装方針

### 利用ライブラリ
- `@hono/zod-openapi` (既にインストール済み)
- `@hono/swagger-ui` (既にインストール済み)

### ルーティング構造案
```typescript
import { createRoute } from '@hono/zod-openapi';
```

### 対象エンドポイント
- API routes (`/api/v1/*`) - 8エンドポイント

### ドキュメント公開場所
- OpenAPI JSON: `/api/v1/doc`
- Swagger UI: `/api/v1/ui`

### スキーマ定義が必要な項目
1. **Health Check**: 基本的なヘルスチェック応答
2. **Setup**: 設定項目の定義とバリデーション
3. **Sheets**: Google Sheets操作のリクエスト/レスポンス
4. **Storage**: ファイルアップロード/削除の仕様
5. **Auth**: 認証関連のユーザー情報

### 実装ステップ
1. 基本的なOpenAPIルーター作成
2. 各エンドポイントのスキーマ定義
3. 既存ルーターとの統合
4. Swagger UIの設定
5. テスト（npm test とTypeScriptチェック）とドキュメント確認