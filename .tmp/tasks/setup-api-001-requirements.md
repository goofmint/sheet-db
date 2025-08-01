# 001 POST /api/v1/setup 部分更新対応 - 要件定義

## 概要

現在のPOST /api/v1/setup APIは完全な設定データを前提としているが、実際の運用では個別の設定項目を部分的に更新する需要がある。この拡張により、より柔軟で使いやすいセットアップAPIを提供する。

## 現在の仕様分析

### 既存の機能

1. **完全セットアップ**: Google OAuth、Auth0、アプリケーション設定を一括で設定
2. **部分セットアップ**: ストレージ設定やシートID選択を個別に設定（一部対応済み）
3. **認証機能**: セットアップ完了後は認証が必要（Bearer トークン）
4. **フラット設定データ**: ドット記法によるキー・バリュー形式もサポート

### 既存の制限

1. 必須フィールドの厳格なバリデーション（初回セットアップ時）
2. 部分更新時の不十分なバリデーション制御
3. 更新対象フィールドの明示的な指定ができない

## 要件定義

### 機能要件

#### FR-001: 部分更新モードの実装
- 任意の設定項目のみを更新可能
- 既存の設定値を保持しつつ、指定された項目のみを更新

#### FR-002: 更新フィールドの明示的指定
- `updateFields` パラメータで更新対象を明示
- 未指定フィールドは現在値を保持

##### updateFields 文法定義

`updateFields` は以下のBNF形式で定義される:

```bnf
field_path    ::= top_level | dotted_path
top_level     ::= "google" | "auth0" | "app" | "storage" | "sheetId"
dotted_path   ::= prefix "." suffix
prefix        ::= "google" | "auth0" | "app" | "storage"
suffix        ::= field_name | nested_path
field_name    ::= [a-zA-Z][a-zA-Z0-9]*
nested_path   ::= storage_path
storage_path  ::= ("r2" | "gdrive") ["." field_name]
```

**有効な例:**
- `"google"`, `"auth0"`, `"app"`, `"storage"`, `"sheetId"`
- `"google.clientId"`, `"auth0.domain"`, `"app.configPassword"`
- `"storage.type"`, `"storage.r2"`, `"storage.gdrive"`
- `"storage.r2.bucket"`, `"storage.gdrive.folderId"`

**無効な例:**
- `"invalid_field"` (未定義のトップレベルフィールド)
- `"google.unknown"` (存在しないサブフィールド)
- `"storage.r2.unknown"` (無効なネストパス)
- `"google..clientId"` (二重ドット)
- `""` (空文字列)

#### FR-003: 条件付きバリデーション
- 新規セットアップ時: 全必須フィールドの検証
- 部分更新時: 指定されたフィールドのみの検証
- 相互依存フィールドの検証（例：ストレージタイプとその詳細設定）

#### FR-004: レスポンス形式の統一
- 成功・失敗レスポンスの一貫性
- 更新されたフィールドの明示

### 非機能要件

#### NFR-001: 互換性の維持
- 既存のAPIクライアントが引き続き動作
- 既存のレスポンス形式を変更しない

#### NFR-002: セキュリティ
- 部分更新時も同様の認証要件
- 機密情報の適切な取り扱い

#### NFR-003: パフォーマンス
- 不要なデータベースアクセスを回避
- キャッシュ更新の最適化

## ユースケース

### UC-001: Google OAuth設定のみ更新
```json
{
  "updateFields": ["google"],
  "google": {
    "clientId": "new-client-id.googleusercontent.com",
    "clientSecret": "new-client-secret"
  }
}
```

### UC-002: ストレージ設定の変更
```json
{
  "updateFields": ["storage"],
  "storage": {
    "type": "gdrive",
    "gdrive": {
      "folderId": "new-folder-id"
    }
  }
}
```

### UC-003: 個別設定項目の更新（フラット形式）
```json
{
  "updateFields": ["app.config_password"],
  "app.config_password": "newSecurePassword123"
}
```

## 制約条件

### C-001: 依存関係の制約
- ストレージタイプが`r2`の場合、R2関連の全フィールドが必要
- ストレージタイプが`gdrive`の場合、Google Drive関連の全フィールドが必要

### C-002: セキュリティ制約
- セットアップ完了後の更新には認証が必要
- パスワード更新時は強度チェックを実施

### C-003: データ整合性制約
- 無効な設定による既存機能の破損を防止
- ロールバック可能な更新処理

## 期待される効果

1. **運用性の向上**: 個別設定の変更が容易になる
2. **ユーザビリティの向上**: 必要な項目のみを更新可能
3. **エラー率の削減**: 不要なフィールド入力によるミスを防止
4. **システム安定性**: 段階的な設定変更によるリスク軽減