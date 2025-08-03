# タスクリスト - GoogleシートバックエンドAPIサービス「sheetDB」

最終更新: 2025-07-28  
管理ドキュメント: [task-management.md](./task-management.md)

## タスクファイル形式

個別タスクファイル（.tmp/tasks/以下）は以下の形式を推奨：

```markdown
# [タスク番号] タスク名

## ステータス
- [x] 完了 / [ ] 未完了  
- 開始日: YYYY-MM-DD
- 完了日: YYYY-MM-DD

## 概要
[タスクの概要]

## 実装内容
[実装内容の詳細]

## 関連ファイル
- 作成/変更されたファイル一覧

## 依存関係
- 前提となるタスク
- このタスクに依存するタスク

## メモ
実装時の注意点や学習内容
```

## Phase 1: 基盤構築 ✅ **完了**

### 1.1 プロジェクト構造のセットアップ ✅
- [x] src/index.tsの作成（メインエントリーポイント） - [詳細](./tasks/1.1.1-project-setup.md)
- [x] src/types/index.tsの作成（型定義） - [詳細](./tasks/1.1.2-types-definition.md)
- [x] src/config/index.tsの作成（設定管理） - [詳細](./tasks/1.1.3-config-management.md)
- [x] src/utils/logger.tsの作成（ログユーティリティ） - [詳細](./tasks/1.1.4-logger-utility.md)
- [x] src/middleware/error-handler.tsの作成（エラーハンドリング） - [詳細](./tasks/1.1.5-error-handler.md)

### 1.2 D1データベーススキーマの実装 ✅
- [x] schema.sqlの更新（Config、Cache、Sessionテーブル） - [詳細](./tasks/1.2-database-schema.md)
- [x] src/db/schema.tsの更新（Drizzle ORM定義）
- [x] src/repositories/config.tsの作成
- [x] src/repositories/cache.tsの作成
- [x] src/repositories/session.tsの作成
- [x] マイグレーションスクリプトの作成と実行

### 1.3 基本的なAPIルーティング ✅
- [x] src/api/index.tsの作成（ルートルーティング） - [詳細](./tasks/1.3.1-api-routing.md)
- [x] src/api/v1/health/get.tsの作成（ヘルスチェック）
- [x] src/api/v1/setup/get.tsの作成（セットアップ画面） - [詳細](./tasks/setup-api-endpoint.md)
- [x] src/api/v1/setup/post.tsの作成（セットアップ処理）
- [x] src/api/v1/playground/get.tsの作成（Playground画面） - [詳細](./tasks/playground-api-design.md)
- [x] HTMLテンプレートの作成（setup.html、playground.html） - [詳細](./tasks/setup-ui-design.md)

## Phase 2: 認証・認可

### 2.1 Auth0統合
- [x] src/services/auth0.tsの作成（Auth0サービス） - [詳細](./tasks/2.1.1-auth0-service.md)
- [x] src/api/v1/auth/login/get.tsの作成（ログインリダイレクト） - [詳細](./tasks/2.1.2-login-api.md)
- [x] src/api/v1/auth/callback/get.tsの作成（Auth0コールバック） - [詳細](./tasks/2.1.3-auth-callback.md)
- [x] src/api/v1/auth/logout/post.tsの作成（ログアウト） - [詳細](./tasks/2.1.4-logout-api.md)
- [x] src/api/v1/auth/me/get.tsの作成（現在のユーザー情報） - [詳細](./tasks/2.1.5-auth-me-api.md)

### 2.2 設定管理UI ✅ **完了**
- [x] GET /api/v1/configs の実装（設定項目の一覧取得） - [詳細](./tasks/2.2.4-configs-list-api.md)
- [x] GET /api/v1/configs/:key の実装（設定項目の取得） - [詳細](./tasks/2.2.2-configs-get-by-key-api.md)
- [x] POST /api/v1/configs の実装（設定項目の追加） - [詳細](./tasks/2.2.3-post-configs-api.md)
- [x] PUT /api/v1/configs/:key の実装（設定項目の更新） - [詳細](./tasks/2.2.5-put-configs-api.md)
- [x] DELETE /api/v1/configs/:key の実装（設定項目の削除） - [詳細](./tasks/2.2.6-delete-configs-api.md)
- [ ] GET /config の実装（設定管理画面） - [詳細](./tasks/2.2-config-management-ui.md)

### 2.3 セッション管理
- [x] src/services/session.tsの作成（セッション管理） - [詳細](./tasks/2.3.1-session-service.md)
- [ ] src/middleware/auth.tsの作成（認証ミドルウェア） - [詳細](./tasks/2.3.2-auth-middleware.md)
- [ ] JWTトークン検証の実装
- [ ] セッションの有効期限管理
- [ ] リフレッシュトークンの実装

### 2.3 ACL実装
- [ ] src/services/acl.tsの作成（アクセス制御サービス）
- [ ] src/middleware/authorization.tsの作成（認可ミドルウェア）
- [ ] 公開データアクセスの実装
- [ ] ユーザーベースアクセス制御
- [ ] ロールベースアクセス制御
- [ ] マスターキー認証の実装

## Phase 3: Google Sheets統合

### 3.1 Google Sheets API連携
- [ ] src/services/google-auth.tsの作成（Google認証）
- [ ] src/services/google-sheets.tsの作成（Sheets API）
- [ ] Google OAuth2フローの実装
- [ ] アクセストークン管理（複数アカウント対応）
- [ ] APIレート制限対策の実装

### 3.2 データ読み書き機能
- [ ] src/api/sheets/get.tsの作成（シート一覧）
- [ ] src/api/sheets/post.tsの作成（シート作成）
- [ ] src/api/sheets/$sheetName/get.tsの作成（シートデータ取得）
- [ ] src/api/sheets/$sheetName/put.tsの作成（シート更新）
- [ ] src/api/sheets/$sheetName/delete.tsの作成（シート削除）

### 3.3 データCRUD API
- [ ] src/api/sheets/$sheetName/data/get.tsの作成（データ検索）
- [ ] src/api/sheets/$sheetName/data/post.tsの作成（データ作成）
- [ ] src/api/sheets/$sheetName/data/$id/get.tsの作成（データ取得）
- [ ] src/api/sheets/$sheetName/data/$id/put.tsの作成（データ更新）
- [ ] src/api/sheets/$sheetName/data/$id/delete.tsの作成（データ削除）
- [ ] クエリパラメータ処理（フィルタ、ソート、ページネーション）

### 3.4 スキーマ管理
- [ ] src/api/sheets/$sheetName/schema/get.tsの作成（スキーマ取得）
- [ ] src/api/sheets/$sheetName/schema/put.tsの作成（スキーマ更新）
- [ ] src/utils/schema-parser.tsの作成（スキーマ解析）
- [ ] src/utils/schema-validator.tsの作成（データ検証）
- [ ] デフォルトシート構造の自動生成

## Phase 4: キャッシュ・最適化

### 4.1 キャッシュ機構の実装
- [ ] src/services/cache.tsの作成（キャッシュサービス）
- [ ] URL正規化関数の実装
- [ ] キャッシュ読み取りロジック
- [ ] キャッシュ書き込みロジック
- [ ] キャッシュ有効期限の管理

### 4.2 バックグラウンド更新
- [ ] src/workers/cache-refresh.tsの作成（キャッシュ更新）
- [ ] Cloudflare Workers waitUntilの活用
- [ ] 期限切れキャッシュの返却とバックグラウンド更新
- [ ] 書き込み時のキャッシュ無効化

### 4.3 パフォーマンス最適化
- [ ] インデックスの最適化
- [ ] バッチ処理の実装
- [ ] 部分読み込みの実装
- [ ] 大量データ対応（ストリーミング）

## Phase 5: 拡張機能

### 5.1 ファイルアップロード（R2/Google Drive） 🔄 **部分完了**
- [x] src/api/v1/storages/route.tsの作成（アップロード）
- [ ] ファイルアップロード設定のConfig化（サイズ制限、許可タイプ）
- [ ] src/api/files/$fileId/get.tsの作成（ダウンロード）
- [ ] src/api/files/$fileId/delete.tsの作成（削除）
- [x] src/services/storage/r2.tsの作成（R2ストレージ）
- [x] src/services/storage/google-drive.tsの作成（Driveストレージ）
- [ ] _Fileシートのメタデータ管理

### 5.2 セキュリティ強化 ✅ **完了**
- [x] タイミング攻撃対策（定数時間比較関数の実装）
- [x] XSS脆弱性修正（インラインスクリプト削除、データ属性使用）
- [x] 入力検証とサニタイゼーション強化
- [x] D1データベースでのトランザクション対応（ConfigServiceのみ）
- [x] 型安全性向上（TypeScriptインターフェース追加）
- [x] ファイルアップロード検証（サイズ・タイプ制限）

### 5.3 OpenAPI仕様書生成
- [ ] src/api/docs/get.tsの作成（OpenAPIドキュメント）
- [ ] src/utils/openapi-generator.tsの作成
- [ ] 各APIエンドポイントのスキーマ定義
- [ ] Swagger UIの統合

### 5.4 Playground UI
- [ ] templates/playground.htmlの改善
- [ ] APIテストインターフェースの実装
- [ ] リアルタイムレスポンス表示
- [ ] 認証状態の表示

## テストとドキュメント

### テスト実装
- [ ] 各APIエンドポイントの統合テスト
- [ ] 認証・認可のテスト
- [ ] キャッシュ機能のテスト
- [ ] Google Sheets連携のテスト
- [ ] エラーハンドリングのテスト

### ドキュメント作成
- [ ] README.mdの更新
- [ ] API使用ガイド
- [ ] セットアップガイド
- [ ] トラブルシューティングガイド

## デプロイメント

### CI/CD設定
- [ ] GitHub Actionsワークフローの作成
- [ ] 自動テストの設定
- [ ] 型チェックとリントの設定
- [ ] Cloudflare Workersへの自動デプロイ

### 本番環境準備
- [ ] 環境変数の設定
- [ ] Cloudflare設定の最適化
- [ ] モニタリングの設定
- [ ] バックアップ戦略の実装

## 個別タスクファイル一覧

### 作成済みタスクファイル
- `1.1.1-project-setup.md` - メインエントリーポイント
- `1.1.2-types-definition.md` - 型定義
- `1.1.3-config-management.md` - 設定管理
- `1.1.4-logger-utility.md` - ログユーティリティ
- `1.1.5-error-handler.md` - エラーハンドリング
- `1.2-database-schema.md` - D1データベーススキーマ
- `1.3.1-api-routing.md` - APIルーティング
- `setup-api-endpoint.md` - セットアップGET API
- `setup-ui-design.md` - セットアップUI設計
- `playground-api-design.md` - Playground設計

### 未作成タスクファイル（推奨）
#### Phase 1.3系
- `1.3.2-health-endpoint.md` - ヘルスチェックAPI
- `1.3.3-setup-post-endpoint.md` - セットアップPOST API
- `1.3.4-html-templates.md` - HTMLテンプレート

#### Phase 5.1系
- `5.1.1-storage-api.md` - ストレージAPI実装
- `5.1.2-r2-integration.md` - R2統合詳細
- `5.1.3-google-drive-integration.md` - Google Drive統合詳細

#### Phase 5.2系
- `5.2-security-implementation.md` - セキュリティ実装総括