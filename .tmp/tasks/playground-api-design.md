# Playground 画面設計書

## 概要
開発者がAPIをテストできるインタラクティブなプレイグラウンド画面を提供するWebページエンドポイントの設計書

## エンドポイント
`GET /api/v1/playground`

## 目的
- 実際のAPIエンドポイントをブラウザ上で直接テスト実行できるUI提供
- 各APIエンドポイントのドキュメント表示
- リアルタイムでのAPIレスポンス確認
- 認証設定とAPIテスト実行

## レスポンス仕様

### 成功時 (200)
```
Content-Type: text/html; charset=utf-8
```

HTMLページを返却し、以下の機能を提供：

#### 1. API エンドポイント一覧
- 利用可能なAPIエンドポイントの一覧表示
- 各エンドポイントのHTTPメソッド、URL、説明
- パラメータ情報とサンプルリクエスト

#### 2. インタラクティブAPIテスト機能
- リクエストURLの入力フィールド
- HTTPメソッド選択（GET, POST, PUT, DELETE）
- ヘッダー設定（Authorization等）
- リクエストボディ入力（JSON）
- 送信ボタンで実際のAPIエンドポイントにリクエスト送信
- リアルタイムでのAPIレスポンス表示

#### 3. 認証機能
- Auth0ログイン状態の表示
- 設定パスワードでのアクセス（セットアップ完了時）
- 認証トークンの表示と管理

#### 4. レスポンス表示
- JSONレスポンスの整形表示
- HTTPステータスコードと詳細
- レスポンスヘッダー情報
- エラー時の詳細情報

## HTML構造設計

### ページレイアウト
```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <title>SheetDB Playground</title>
    <style>/* CSS styling */</style>
</head>
<body>
    <header>
        <h1>SheetDB API Playground</h1>
        <div class="auth-status">/* 認証状態表示 */</div>
    </header>
    
    <main>
        <section class="api-list">/* API一覧 */</section>
        <section class="test-panel">/* テストパネル */</section>
        <section class="response-panel">/* レスポンス表示 */</section>
    </main>
    
    <script>/* JavaScript機能 */</script>
</body>
</html>
```

### 主要セクション

#### API一覧セクション
- エンドポイント一覧の表形式表示
- クリックでテストパネルに自動入力
- サンプルリクエストの表示

#### テストパネル
- URL入力フィールド
- HTTPメソッド選択
- ヘッダー入力（Key-Value形式）
- リクエストボディ入力（JSONエディタ）
- 送信ボタン

#### レスポンスパネル
- ステータスコード表示
- レスポンスヘッダー表示
- JSONレスポンスの整形済み表示
- コピー機能付き

## 機能要件

### 1. テスト可能なAPIエンドポイント情報
自動的に利用可能なAPIエンドポイントを表示：
- `GET /api` - API情報 ✅ 実装済み
- `GET /api/v1/health` - ヘルスチェック ✅ 実装済み
- `GET /api/v1/setup` - セットアップ状態 ✅ 実装済み
- `POST /api/v1/setup` - セットアップ実行 ✅ 実装済み
- `POST /api/v1/sheets` - シート作成 ✅ 実装済み
- `GET /api/v1/playground` - プレイグラウンドページ ✅ 実装済み
- `POST /api/v1/storages` - ファイルアップロード ✅ 実装済み

このページから実際にこれらのAPIエンドポイントにHTTPリクエストを送信し、レスポンスを確認できます。

### 2. 認証統合
- セットアップ状態の確認
- 認証が必要なエンドポイントの識別
- Authorizationヘッダーの自動設定

### 3. リクエストテンプレート
各エンドポイント用のサンプルリクエスト：

```javascript
const REQUEST_TEMPLATES = {
  'POST /api/v1/setup': {
    headers: { 'Content-Type': 'application/json' },
    body: {
      google: {
        clientId: "your-client-id.apps.googleusercontent.com",
        clientSecret: "your-client-secret"
      },
      auth0: {
        domain: "your-domain.auth0.com",
        clientId: "your-auth0-client-id",
        clientSecret: "your-auth0-client-secret"
      },
      app: {
        configPassword: "your-secure-password"
      }
    }
  }
}
```

### 4. UI/UX機能
- レスポンシブデザイン
- JSON整形表示
- シンタックスハイライト
- コピー＆ペースト機能
- リクエスト履歴

## セキュリティ考慮事項

### アクセス制御
- 開発環境での利用を前提
- 本番環境では適切なアクセス制限を実装
- 機密情報の適切な表示制御

### 入力検証
- XSS攻撃の防止
- 不正なリクエストの制限
- CSRFトークンの実装（将来的に）

## 技術仕様

### バックエンド実装
- Honoフレームワークでのルート実装
- HTMLテンプレートの生成
- 設定情報の動的取得

### フロントエンド技術
- バニラJavaScript（外部依存なし）
- CSS Grid/Flexboxレイアウト
- Fetch APIでのHTTPリクエスト
- JSON.stringify/parseでのデータ処理

### スタイリング
- ダークテーマ対応
- モダンなフラットデザイン
- アクセシビリティ配慮
- モバイルフレンドリー

## エラーハンドリング

### 予期されるエラー
1. ネットワークエラー（接続失敗）
2. 認証エラー（401 Unauthorized）
3. バリデーションエラー（400 Bad Request）
4. サーバーエラー（500 Internal Server Error）

### エラー表示
- 分かりやすいエラーメッセージ
- エラーの種類に応じた色分け
- 解決方法の提案
- デバッグ情報の表示

## 将来の拡張予定

### フェーズ2
- OpenAPI仕様書との統合
- リクエスト履歴の永続化
- コードジェネレーター機能
- 複数環境対応（dev/staging/prod）

### フェーズ3
- WebSocket接続のテスト機能
- ファイルアップロードのテスト
- パフォーマンス測定機能
- 自動テストスイート生成

## 実装ファイル構成

```
src/api/v1/playground/
├── get.ts              # メインハンドラー
├── templates/
│   └── playground.html # HTMLテンプレート
└── __tests__/
    └── get.spec.ts     # テスト
```

## テスト要件

### 統合テスト
- HTMLレスポンスの返却確認
- 正しいContent-Typeヘッダー
- 認証状態による表示内容の変化

### UI機能テスト
- JavaScript機能の動作確認
- レスポンシブデザインの確認
- 各ブラウザでの互換性確認

### セキュリティテスト
- XSS攻撃の防止確認
- 機密情報の適切な非表示
- 不正リクエストの制限確認