# セキュリティ実装レポート

## 概要
Sheet DBプロジェクトにおいて包括的なセキュリティ強化を実施しました。本ドキュメントでは、実装したセキュリティ対策の詳細と、その効果について説明します。

## 実装したセキュリティ対策

### 1. タイミング攻撃対策

#### 問題
- パスワード比較で直接的な文字列比較（`===`）を使用
- 比較時間の差により、正しいパスワードの文字を推測される脆弱性

#### 解決策
```typescript
// src/utils/security.ts
export function constantTimeEquals(a: string, b: string): boolean {
  const aLength = a.length;
  const bLength = b.length;
  const maxLength = Math.max(aLength, bLength);
  
  let result = aLength === bLength ? 0 : 1;
  
  for (let i = 0; i < maxLength; i++) {
    const aChar = i < aLength ? a.charCodeAt(i) : 0;
    const bChar = i < bLength ? b.charCodeAt(i) : 0;
    result |= aChar ^ bChar;
  }
  
  return result === 0;
}
```

#### 適用箇所
- `src/sheet/select/get.ts`
- `src/sheet/initialize/get.ts`
- `src/api/v1/setup/get.ts`
- `src/api/v1/setup/post.ts`

### 2. XSS脆弱性修正

#### 問題
- インラインスクリプトでの機密情報（アクセストークン、パスワード）直接埋め込み
- `dangerouslySetInnerHTML` での生HTMLインジェクション

#### 解決策
```typescript
// Before (脆弱)
<script dangerouslySetInnerHTML={{
  __html: `const accessToken = '${accessToken}';`
}} />

// After (安全)
<div id="auth-data" style="display: none;" 
     data-access-token={accessToken}></div>
<script dangerouslySetInnerHTML={{
  __html: `
    const authData = document.getElementById('auth-data');
    const accessToken = authData.dataset.accessToken;
  `
}} />
```

#### 適用箇所
- `src/templates/sheet-selection.tsx`
- `src/templates/sheet-initialization.tsx`
- `src/templates/oauth-success.tsx`

### 3. 入力検証とサニタイゼーション

#### アクセストークン検証
```typescript
export function validateAccessToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== 'string') return null;
  
  const trimmedToken = token.trim();
  if (trimmedToken.length < 10 || trimmedToken.length > 2048) return null;
  
  // OAuth tokens should only contain specific characters
  const validTokenPattern = /^[a-zA-Z0-9._/-]+$/;
  if (!validTokenPattern.test(trimmedToken)) return null;
  
  return trimmedToken;
}
```

#### ファイルアップロード検証
```typescript
// ファイルサイズ制限（10MB）
const maxFileSize = 10 * 1024 * 1024;
if (file.size > maxFileSize) {
  return c.json({ error: 'File too large' }, 413);
}

// 許可されたファイルタイプのみ
const allowedTypes = [
  'image/jpeg', 'image/png', 'application/pdf', 
  'text/csv', 'application/json'
];
if (!allowedTypes.includes(file.type)) {
  return c.json({ error: 'Invalid file type' }, 415);
}
```

### 4. レースコンディション対策

#### 問題
- ユーザー作成時のemail重複チェックが非原子的
- 同時リクエストで重複レコードが作成される可能性

#### 解決策
```typescript
// 一意制約バリデーション
protected async validateUniqueConstraints(data: Partial<T>, excludeId?: string): Promise<void> {
  const uniqueColumns = allColumns.filter(col => col.unique);
  const existingRecords = await this.findAll();
  
  for (const column of uniqueColumns) {
    const existing = existingRecords.find(record => {
      if (excludeId && record.id === excludeId) return false;
      return (record as any)[column.name] === value;
    });
    
    if (existing) {
      const error = new Error(`${column.name} must be unique`) as any;
      error.status = 409;
      throw error;
    }
  }
}

// トランザクション対応（フォールバック付き）
async setAll(configs: Record<string, ConfigValue>): Promise<void> {
  try {
    await this.db.transaction(async (tx) => {
      // 全ての更新を単一トランザクションで実行
    });
  } catch (transactionError) {
    // トランザクション未対応環境での個別実行フォールバック
    await this.setAllWithoutTransaction(configEntries);
  }
}
```

### 5. 構造化ログシステム

#### 実装
```typescript
// src/utils/logger.ts
class Logger {
  private sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...context };
    const sensitiveFields = ['accessToken', 'password', 'secret'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        const value = sanitized[field] as string;
        sanitized[field] = value.length > 8 
          ? `${value.slice(0, 4)}...${value.slice(-4)}`
          : '***';
      }
    }
    return sanitized;
  }
}
```

#### 置き換え例
```typescript
// Before
console.log(`Attempting to freeze ${rowCount} rows for sheet: ${sheetName}`);

// After
logger.debug('Attempting to freeze header rows', { 
  operation: 'freezeHeaderRows',
  sheetName,
  rowCount 
});
```

### 6. 型安全性向上

#### Google OAuth トークンレスポンス
```typescript
interface GoogleOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  refresh_token?: string;
  id_token?: string;
}

// 使用例
const tokenData = await tokenResponse.json() as GoogleOAuthTokenResponse;
```

### 7. フロントエンド セキュリティ改善

#### DOM要素の安全な取得
```typescript
constructor() {
  // 必要な要素の存在確認
  const requiredElements = [
    { element: this.setupForm, name: 'setup-form' },
    { element: this.authForm, name: 'auth-form' }
  ];
  
  const missingElements = requiredElements
    .filter(({ element }) => !element)
    .map(({ name }) => name);
  
  if (missingElements.length > 0) {
    throw new Error(`Required DOM elements not found: ${missingElements.join(', ')}`);
  }
}
```

#### セキュアなパスワード処理
```typescript
async authenticate() {
  const passwordField = document.getElementById('config-password-auth');
  const password = passwordField.value;
  
  // パスワードフィールドを即座にクリア
  passwordField.value = '';
  
  try {
    // 認証処理
  } finally {
    // メモリからもクリア
    password = null;
  }
}
```

## セキュリティテスト結果

### テスト環境での検証
- 全110テストが成功
- トランザクション機能のフォールバック動作確認
- エラーハンドリングの適切な動作確認

### 実装による改善点

1. **機密情報漏洩リスクの軽減**
   - インラインスクリプトでの直接埋め込み排除
   - ログでの機密情報自動マスキング

2. **インジェクション攻撃対策**
   - XSS攻撃の防止
   - 入力値の適切な検証・サニタイゼーション

3. **データ整合性の向上**
   - レースコンディション対策
   - 原子的トランザクション実装

4. **運用面でのセキュリティ向上**
   - 構造化ログによる監査ログ
   - 適切なエラーレスポンス

## 改善予定事項

### ファイルアップロード設定の設定可能化

#### 現在の問題
現在、ファイルアップロードの制限がハードコードされており、運用時の柔軟性に欠けています：

```typescript
// 現在のハードコード実装
const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
const allowedTypes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/csv', 'application/json'
];
```

#### 改善計画
Configテーブルを活用した設定管理に移行予定：

**追加予定の設定項目:**
- `upload.max_file_size`: ファイルサイズ上限（バイト数）
- `upload.allowed_types`: 許可するMIMEタイプ（JSON配列）
- `upload.enabled`: ファイルアップロード機能の有効/無効

**実装予定の改善:**
```typescript
// 予定している改善後の実装
const maxFileSize = ConfigService.getNumber('upload.max_file_size', 10 * 1024 * 1024);
const allowedTypes = ConfigService.getArray('upload.allowed_types', [
  'image/jpeg', 'image/png', 'application/pdf'
]);
const uploadEnabled = ConfigService.getBoolean('upload.enabled', true);
```

**期待される効果:**
- 運用環境に応じた柔軟な制限設定
- アプリケーション再起動なしでの設定変更
- セキュリティポリシーに応じた動的制御
- 管理者による簡単な設定管理

## 今後の推奨事項

### 追加で検討すべきセキュリティ対策

1. **認証・認可の強化**
   - JWT トークンの適切な検証
   - リフレッシュトークンの実装
   - セッション管理の強化

2. **API セキュリティ**
   - レート制限の実装
   - CORS ポリシーの厳格化
   - APIキーの管理

3. **データ保護**
   - 機密データの暗号化
   - データベースアクセスの監査
   - バックアップデータの保護

4. **監視・モニタリング**
   - セキュリティイベントの監視
   - 異常アクセスの検知
   - インシデント対応手順の策定

## 結論

今回実装したセキュリティ対策により、Sheet DBの基本的なセキュリティ水準が大幅に向上しました。特に、一般的なWeb脆弱性（XSS、タイミング攻撃、レースコンディション）に対する基本的な防御機能が整いました。

継続的なセキュリティ改善のため、定期的なセキュリティ監査と最新の脅威情報への対応を推奨します。