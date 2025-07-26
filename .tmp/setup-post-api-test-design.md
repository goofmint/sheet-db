# Setup POST API テスト設計書

## 概要
Setup POST APIの包括的なテストケース設計書

## テスト構成

### 1. 統合テスト (post.spec.ts)

#### 正常系テスト
```typescript
describe('Setup POST API - Success Cases', () => {
  it('should complete initial setup with valid configuration')
  it('should allow re-setup with valid authentication')
  it('should handle optional database URL field')
  it('should return proper success response structure')
})
```

#### 認証テスト
```typescript
describe('Setup POST API - Authentication', () => {
  it('should allow setup when not completed (no auth required)')
  it('should require authentication when setup already completed')
  it('should reject invalid Bearer token')
  it('should reject malformed Authorization header')
})
```

#### バリデーションエラーテスト
```typescript
describe('Setup POST API - Validation Errors', () => {
  it('should reject missing required fields')
  it('should reject invalid Google OAuth credentials')
  it('should reject invalid Auth0 configuration')
  it('should reject weak passwords')
  it('should reject invalid database URLs')
  it('should return detailed validation error messages')
})
```

#### エラーハンドリングテスト
```typescript
describe('Setup POST API - Error Handling', () => {
  it('should handle database connection failures')
  it('should handle ConfigService exceptions')
  it('should handle concurrent setup attempts')
  it('should return proper error response format')
})
```

### 2. バリデーション単体テスト (validators.spec.ts)

#### validateSetupRequest
```typescript
describe('validateSetupRequest', () => {
  it('should validate complete valid request')
  it('should reject null/undefined input')
  it('should reject non-object input')
  it('should validate each required field')
  it('should handle optional fields correctly')
})
```

#### validateGoogleOAuthCredentials
```typescript
describe('validateGoogleOAuthCredentials', () => {
  it('should validate correct Google OAuth format')
  it('should reject invalid Client ID format')
  it('should reject too short Client Secret')
  it('should handle edge cases (empty strings, special chars)')
})
```

#### validateAuth0Configuration
```typescript
describe('validateAuth0Configuration', () => {
  it('should validate correct Auth0 domain formats')
  it('should reject invalid domain formats')
  it('should validate Client ID length and format')
  it('should validate Client Secret requirements')
})
```

#### validateConfigPassword
```typescript
describe('validateConfigPassword', () => {
  it('should accept strong passwords')
  it('should reject passwords too short')
  it('should reject passwords without uppercase')
  it('should reject passwords without lowercase')
  it('should reject passwords without numbers')
  it('should provide helpful error messages')
})
```

## テストデータ

### 有効なテストデータ
```typescript
const VALID_SETUP_DATA = {
  google: {
    clientId: "123456789.apps.googleusercontent.com",
    clientSecret: "GOCSPX-abcdefghijklmnopqrstuvwxyz"
  },
  auth0: {
    domain: "test-domain.auth0.com",
    clientId: "abcdefghijklmnopqrstuvwxyz123456",
    clientSecret: "abcdefghijklmnopqrstuvwxyz123456789abcdefghijklmnopqrstuvwxyz12"
  },
  app: {
    configPassword: "SecurePass123!"
  },
  database: {
    url: "https://api.example.com/database"
  }
};
```

### 無効なテストデータ
```typescript
const INVALID_TEST_CASES = {
  MISSING_GOOGLE_CLIENT_ID: { /* google.clientId missing */ },
  INVALID_GOOGLE_CLIENT_ID: { /* wrong format */ },
  WEAK_PASSWORD: { /* password: "123" */ },
  INVALID_AUTH0_DOMAIN: { /* domain: "invalid-domain" */ },
  INVALID_DATABASE_URL: { /* url: "not-a-url" */ }
};
```

## モックとスタブ

### ConfigService モック
```typescript
const mockConfigService = {
  getBoolean: vi.fn(),
  getString: vi.fn(),
  upsert: vi.fn(),
  refreshCache: vi.fn()
};
```

### 外部API モック
- Google OAuth検証API
- Auth0設定検証API
- データベース接続テスト

## パフォーマンステスト

### レスポンス時間
- 正常系: 500ms以内
- バリデーションエラー: 100ms以内
- 認証エラー: 50ms以内

### 並行処理テスト
- 同時セットアップリクエストの処理
- データ競合状態のテスト

## セキュリティテスト

### 入力検証テスト
```typescript
describe('Security Tests', () => {
  it('should prevent SQL injection in input fields')
  it('should prevent XSS in response data')
  it('should not log sensitive information')
  it('should handle malformed JSON gracefully')
})
```

### 認証バイパステスト
- 不正なトークンでのアクセス試行
- セッション固定攻撃の対処
- タイミング攻撃の対策

## エラーシナリオテスト

### データベースエラー
- 接続失敗
- 書き込み失敗
- トランザクション失敗

### 外部サービスエラー
- Google API応答なし
- Auth0サービス停止
- ネットワークタイムアウト

### リソース不足
- メモリ不足時の動作
- CPU高負荷時の応答

## テスト環境要件

### 前提条件
- D1データベースのセットアップ
- ConfigServiceの初期化
- テスト用シークレットの設定

### クリーンアップ
- 各テスト後のデータベース状態リセット
- モックの状態クリア
- 一時ファイルの削除

## 継続的インテグレーション

### 自動テスト実行
- Pull Request時の全テスト実行
- 本番デプロイ前の回帰テスト
- 定期的なセキュリティテスト

### カバレッジ要件
- 行カバレッジ: 95%以上
- 分岐カバレッジ: 90%以上
- 関数カバレッジ: 100%

## 品質ゲート

### 必須条件
- 全テストパス
- カバレッジ要件達成
- セキュリティテストパス
- パフォーマンス要件達成

### 警告条件
- 新しいセキュリティ脆弱性の検出
- パフォーマンス劣化の検出
- 依存関係の脆弱性