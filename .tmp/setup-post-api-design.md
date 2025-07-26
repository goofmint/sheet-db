# Setup POST API 設計書

## 概要
セットアップ処理を行うPOST APIエンドポイントの設計書

## エンドポイント
`POST /api/v1/setup`

## 目的
- アプリケーションの初期セットアップを実行
- 設定値の保存と検証
- セットアップ完了フラグの設定

## リクエスト仕様

### Content-Type
`application/json`

### 認証
- セットアップ未完了時: 認証不要
- セットアップ完了時: `Authorization: Bearer <config_password>` が必要

### リクエストボディ
```typescript
interface SetupRequest {
  google: {
    clientId: string;
    clientSecret: string;
  };
  auth0: {
    domain: string;
    clientId: string;
    clientSecret: string;
  };
  app: {
    configPassword: string;
  };
  database?: {
    url?: string;
  };
}
```

### バリデーション
- 必須フィールドのチェック
- Google OAuth認証情報の妥当性確認
- Auth0設定の妥当性確認
- パスワード強度の確認（最低8文字、英数字含む）

## レスポンス仕様

### 成功時 (200)
```typescript
interface SetupSuccessResponse {
  success: true;
  message: string;
  setup: {
    isCompleted: true;
    completedAt: string; // ISO 8601 timestamp
    configuredServices: string[]; // ["google", "auth0", "database"]
  };
  timestamp: string;
}
```

### バリデーションエラー (400)
```typescript
interface SetupValidationErrorResponse {
  error: {
    code: "VALIDATION_ERROR";
    message: string;
    details: {
      field: string;
      message: string;
    }[];
  };
  timestamp: string;
}
```

### 認証エラー (401)
```typescript
interface SetupAuthErrorResponse {
  error: {
    code: "AUTHENTICATION_REQUIRED";
    message: string;
  };
  timestamp: string;
}
```

### 設定エラー (409)
```typescript
interface SetupConflictErrorResponse {
  error: {
    code: "SETUP_ALREADY_COMPLETED" | "INVALID_CREDENTIALS";
    message: string;
  };
  timestamp: string;
}
```

### サーバーエラー (500)
```typescript
interface SetupServerErrorResponse {
  error: {
    code: "INTERNAL_ERROR";
    message: string;
  };
  timestamp: string;
}
```

## 処理フロー

### 1. 認証チェック
1. セットアップ完了状態を確認
2. 完了済みの場合、Authorization headerを検証
3. 未認証の場合は401エラー

### 2. リクエストバリデーション
1. 必須フィールドの存在確認
2. データ形式の検証
3. 各サービス認証情報の妥当性確認

### 3. 設定保存
1. バリデーション済みデータをConfigテーブルに保存
2. パスワードのハッシュ化（bcryptまたはscrypt）
3. 設定完了フラグの更新

### 4. レスポンス返却
1. 成功レスポンスの生成
2. タイムスタンプ付与
3. JSON形式で返却

## セキュリティ考慮事項

### データ保護
- 機密情報（client_secret、password）の適切な暗号化
- メモリ上での機密データの適切な処理
- ログ出力時の機密情報マスキング

### アクセス制御
- セットアップ完了後の再設定時の認証必須
- CORS設定による適切なオリジン制限
- Rate limiting（将来的に実装）

### 入力検証
- SQLインジェクション対策
- XSS対策
- 不正なJSON構造の拒否

## エラーハンドリング

### 予期されるエラー
1. 不正なGoogle OAuth認証情報
2. 不正なAuth0設定
3. 弱いパスワード
4. データベース接続エラー
5. 設定保存エラー

### ログ記録
- エラー発生時の詳細ログ
- セキュリティイベントの監査ログ
- パフォーマンス測定ログ

## テスト要件

### 単体テスト
- バリデーション関数のテスト
- 認証ロジックのテスト
- エラーハンドリングのテスト

### 統合テスト
- エンドツーエンドセットアップフローのテスト
- 各種エラーケースのテスト
- 認証状態による動作の違いのテスト

### セキュリティテスト
- 不正データでの攻撃テスト
- 認証バイパステスト
- 機密情報漏洩テスト

## 実装ファイル構成

```
src/api/v1/setup/
├── post.ts              # メインハンドラー
├── types.ts            # 型定義（既存）
├── validators.ts       # バリデーション関数
└── __tests__/
    ├── post.spec.ts    # 統合テスト
    └── validators.spec.ts # バリデーションテスト
```

## 関連サービス

### ConfigService
- 設定値の保存・取得
- セットアップ状態の管理

### ValidationService（新規作成）
- Google OAuth認証情報の検証
- Auth0設定の検証
- パスワード強度の検証

### CryptoService（新規作成）
- パスワードのハッシュ化
- 機密情報の暗号化

## マイルストーン

1. **Phase 1**: 基本的なPOSTハンドラーの実装
2. **Phase 2**: バリデーション機能の実装
3. **Phase 3**: セキュリティ機能の実装
4. **Phase 4**: テストの充実
5. **Phase 5**: エラーハンドリングの強化

## 今後の拡張予定

- 設定の部分更新機能
- 設定のバックアップ・リストア機能
- 複数環境対応（開発・本番設定の切り替え）
- 設定変更の履歴管理