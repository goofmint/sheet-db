# Setup バリデーション設計書

## 概要
Setup POST APIで使用するバリデーション関数の設計書

## バリデーション関数一覧

### 1. validateSetupRequest
```typescript
function validateSetupRequest(data: unknown): {
  isValid: boolean;
  errors: ValidationError[];
  data?: SetupRequest;
}
```

#### 責務
- リクエストボディ全体の構造チェック
- 各フィールドの存在チェック
- データ型の検証

#### バリデーションルール
- `google.clientId`: 必須、文字列、空文字不可
- `google.clientSecret`: 必須、文字列、空文字不可
- `auth0.domain`: 必須、文字列、ドメイン形式
- `auth0.clientId`: 必須、文字列、空文字不可
- `auth0.clientSecret`: 必須、文字列、空文字不可
- `app.configPassword`: 必須、文字列、8文字以上
- `database.url`: オプショナル、文字列、URL形式

### 2. validateGoogleOAuthCredentials
```typescript
function validateGoogleOAuthCredentials(clientId: string, clientSecret: string): {
  isValid: boolean;
  error?: string;
}
```

#### 責務
- Google OAuth認証情報の形式チェック
- Client IDのプレフィックス検証（*.googleusercontent.com）

#### バリデーションルール
- Client ID: `.googleusercontent.com` で終わる
- Client Secret: 最低24文字、英数字・記号

### 3. validateAuth0Configuration
```typescript
function validateAuth0Configuration(domain: string, clientId: string, clientSecret: string): {
  isValid: boolean;
  error?: string;
}
```

#### 責務
- Auth0設定の形式チェック
- ドメイン形式の検証

#### バリデーションルール
- Domain: `.auth0.com` または `.us.auth0.com` または `.eu.auth0.com` で終わる
- Client ID: 32文字の英数字
- Client Secret: 最低64文字の英数字・記号

### 4. validateConfigPassword
```typescript
function validateConfigPassword(password: string): {
  isValid: boolean;
  errors: string[];
}
```

#### 責務
- パスワード強度の検証
- セキュリティ要件の確認

#### バリデーションルール
- 最低8文字
- 大文字を含む
- 小文字を含む
- 数字を含む
- 特殊文字を推奨（警告レベル）

### 5. validateDatabaseUrl
```typescript
function validateDatabaseUrl(url?: string): {
  isValid: boolean;
  error?: string;
}
```

#### 責務
- データベースURL形式の検証
- 接続可能性の確認（オプショナル）

#### バリデーションルール
- 有効なURL形式
- サポートされるプロトコル（https、postgresql、mysql等）
- ホスト名の妥当性

## エラー型定義

```typescript
interface ValidationError {
  field: string;
  message: string;
  code: ValidationErrorCode;
}

enum ValidationErrorCode {
  REQUIRED = "REQUIRED",
  INVALID_FORMAT = "INVALID_FORMAT", 
  TOO_SHORT = "TOO_SHORT",
  TOO_LONG = "TOO_LONG",
  INVALID_DOMAIN = "INVALID_DOMAIN",
  WEAK_PASSWORD = "WEAK_PASSWORD",
  INVALID_URL = "INVALID_URL"
}
```

## ユーティリティ関数

### 1. isValidEmail
```typescript
function isValidEmail(email: string): boolean
```

### 2. isValidUrl  
```typescript
function isValidUrl(url: string): boolean
```

### 3. isValidDomain
```typescript
function isValidDomain(domain: string): boolean
```

### 4. sanitizeInput
```typescript
function sanitizeInput(input: string): string
```

## バリデーション順序

1. **構造チェック**: リクエストボディの基本構造
2. **必須フィールド**: 必要なフィールドの存在確認
3. **データ型チェック**: 各フィールドのデータ型
4. **形式チェック**: 文字列形式、URL形式等
5. **ビジネスロジック**: サービス固有のルール
6. **セキュリティチェック**: パスワード強度等

## エラーメッセージ

### 日本語メッセージ
- 分かりやすい表現
- 修正方法の提示
- セキュリティに配慮した情報開示

### 例
```typescript
const ERROR_MESSAGES = {
  GOOGLE_CLIENT_ID_REQUIRED: "Google Client IDが必要です",
  GOOGLE_CLIENT_ID_INVALID: "Google Client IDの形式が正しくありません（*.googleusercontent.com で終わる必要があります）",
  AUTH0_DOMAIN_INVALID: "Auth0ドメインの形式が正しくありません（例: your-domain.auth0.com）",
  PASSWORD_TOO_WEAK: "パスワードは8文字以上で、大文字・小文字・数字を含む必要があります"
} as const;
```

## テスト戦略

### 正常系テスト
- 有効な全フィールドでの成功パターン
- オプショナルフィールド省略パターン

### 異常系テスト
- 必須フィールド欠如
- 不正なデータ型
- 不正な形式
- 弱いパスワード
- 不正なURL・ドメイン

### 境界値テスト
- 最小・最大文字数
- 特殊文字の扱い
- Unicode文字の扱い

## パフォーマンス考慮事項

- 正規表現の最適化
- 早期リターンによる高速化
- メモ化による重複チェック回避
- 非同期バリデーション（外部API検証）の適切な実装

## セキュリティ考慮事項

- 機密情報のログ出力回避
- タイミング攻撃の対策
- 入力値のサニタイズ
- SQLインジェクション対策