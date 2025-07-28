# Auth0統合設計書 - sheetDB

## 概要
sheetDBにAuth0認証を統合し、セキュアなユーザー認証・認可システムを実装します。

## アーキテクチャ

### 認証フロー
1. **ログイン開始**
   - ユーザーが `/api/auth/login` にアクセス
   - Auth0の認証画面へリダイレクト

2. **Auth0認証**
   - ユーザーがAuth0でログイン（メール/パスワード、ソーシャルログイン等）
   - 認証成功後、認可コードと共にコールバックURLへリダイレクト

3. **トークン交換**
   - `/api/auth/callback` で認可コードを受け取る
   - Auth0 APIを使用してアクセストークン・リフレッシュトークンに交換
   - JWTトークンの検証

4. **セッション作成**
   - D1データベースにセッション情報を保存
   - セッションIDを含むJWTトークンをクライアントに返却

5. **API認証**
   - 各APIリクエストでJWTトークンを検証
   - セッション情報から権限を確認

### コンポーネント構成

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  SheetDB    │────▶│   Auth0     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ D1 Database │
                    │  (Session)  │
                    └─────────────┘
```

## 実装計画

### Phase 1: Auth0サービス基盤
1. **Auth0Service クラス**
   - 認証URL生成
   - トークン交換・検証
   - ユーザー情報取得

### Phase 2: 認証エンドポイント
1. **ログインAPI** (`/api/auth/login`)
   - Auth0へのリダイレクト処理
   - state パラメータでCSRF対策

2. **コールバックAPI** (`/api/auth/callback`)
   - 認可コード受信
   - トークン交換
   - セッション作成

3. **ログアウトAPI** (`/api/auth/logout`)
   - セッション削除
   - Auth0ログアウト

4. **ユーザー情報API** (`/api/auth/me`)
   - 現在のユーザー情報返却

### Phase 3: セッション管理
1. **SessionService**
   - セッションCRUD操作
   - 有効期限管理
   - リフレッシュ処理

2. **認証ミドルウェア**
   - JWTトークン検証
   - セッション確認
   - リクエストコンテキストへのユーザー情報追加

### Phase 4: 認可システム
1. **ACLService**
   - 権限チェック
   - ロールベース制御
   - リソースレベル制御

2. **認可ミドルウェア**
   - エンドポイント別権限チェック
   - データアクセス制御

## セキュリティ考慮事項

### トークン管理
- **アクセストークン**: 短期間有効（1時間）
- **リフレッシュトークン**: 長期間有効（30日）、ローテーション実装
- **セッショントークン**: HTTPOnly Cookie または Authorization ヘッダー

### CSRF対策
- state パラメータの使用
- SameSite Cookie属性

### XSS対策
- トークンをlocalStorageに保存しない
- Content Security Policy設定

### セッション管理
- 定期的な古いセッションのクリーンアップ
- 同時ログインセッション数の制限（オプション）

## 設定項目

### Configテーブル設定
Auth0の設定はD1データベースのConfigテーブルに保存され、ConfigServiceを通じて取得します。環境変数は使用しません。

```typescript
// Configテーブルに保存される設定項目
{
  auth0Domain: "your-tenant.auth0.com",
  auth0ClientId: "your-client-id",
  auth0ClientSecret: "your-client-secret",
  // リダイレクトURIは環境に応じて動的に生成
  // auth0Audience: "https://your-api-identifier" (オプション)
}
```

### 設定取得方法
```typescript
const configService = new ConfigService(env.DB);
const auth0Config = await configService.getAuth0Config();

// リダイレクトURIは実行環境から動的に生成
const redirectUri = `${request.headers.get('origin')}/api/auth/callback`;
```

### 設定の保存方法
セットアップ画面（`/setup`）でAuth0の設定を入力し、Configテーブルに保存します。

### Auth0アプリケーション設定
1. **Application Type**: Regular Web Application
2. **Allowed Callback URLs**: 
   - Production: `https://your-app.com/api/auth/callback`
   - Development: `http://localhost:8787/api/auth/callback`
3. **Allowed Logout URLs**:
   - Production: `https://your-app.com`
   - Development: `http://localhost:8787`
4. **Allowed Web Origins**: Same as above

## エラーハンドリング

### Auth0エラーコード
- `invalid_request`: リクエストパラメータエラー
- `unauthorized_client`: クライアント認証エラー
- `access_denied`: ユーザーが認証を拒否
- `unsupported_response_type`: サポートされないレスポンスタイプ
- `server_error`: Auth0サーバーエラー

### エラーレスポンス形式
```json
{
  "error": {
    "code": "AUTH_ERROR",
    "message": "認証に失敗しました",
    "details": {
      "auth0_error": "invalid_request",
      "auth0_description": "The request is missing a required parameter"
    }
  }
}
```

## テスト戦略

### テストの基本方針
**重要: モック実装は絶対禁止**
- テストでのモック使用は一切禁止します
- すべてのテストは実際のAuth0サービスと連携して実行します
- テスト用のAuth0テナントを使用して実際の動作を検証します

### 単体テスト
- 実際のAuth0 APIを使用したトークン検証ロジックのテスト
- 実際のエラーレスポンスに基づくエラーハンドリングのテスト
- テスト用Auth0アプリケーションの設定を使用

### 統合テスト
- 実際のAuth0を使用した認証フロー全体のE2Eテスト
- 実際のセッション作成・管理のテスト
- 実際の権限チェックのテスト

### 開発環境
- Auth0 Test Tenant の使用（実際のテナント）
- テスト用の認証情報をConfigテーブルに設定
- **モックモードは実装しません** - 常に実際のAuth0サービスを使用

## 今後の拡張

### Phase 5以降の検討事項
1. **MFA (Multi-Factor Authentication)**
   - Auth0 MFA機能の統合
   - バックアップコード管理

2. **ソーシャルログイン**
   - Google, GitHub等の追加
   - アカウント連携機能

3. **組織管理**
   - Auth0 Organizations機能
   - チーム単位のアクセス制御

4. **監査ログ**
   - 認証イベントの記録
   - セキュリティ分析

## 参考資料
- [Auth0 Documentation](https://auth0.com/docs)
- [Auth0 Authorization Code Flow](https://auth0.com/docs/flows/authorization-code-flow)
- [Auth0 Best Practices](https://auth0.com/docs/best-practices)