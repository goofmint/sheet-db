# タスクリスト - GoogleシートバックエンドAPIサービス「sheetDB」

## Phase 1: 基盤構築

### 1.1 プロジェクト構造のセットアップ
- [x] src/index.tsの作成（メインエントリーポイント）
- [x] src/types/index.tsの作成（型定義）
- [x] src/config/index.tsの作成（設定管理）
- [x] src/utils/logger.tsの作成（ログユーティリティ）
- [x] src/middleware/error-handler.tsの作成（エラーハンドリング）

### 1.2 D1データベーススキーマの実装
- [x] schema.sqlの更新（Config、Cache、Sessionテーブル）
- [x] src/db/schema.tsの更新（Drizzle ORM定義）
- [x] src/repositories/config.tsの作成
- [x] src/repositories/cache.tsの作成
- [x] src/repositories/session.tsの作成
- [x] マイグレーションスクリプトの作成と実行

### 1.3 基本的なAPIルーティング
- [x] src/api/index.tsの作成（ルートルーティング）
- [x] src/api/v1/health/get.tsの作成（ヘルスチェック）
- [x] src/api/v1/setup/get.tsの作成（セットアップ画面）
- [x] src/api/v1/setup/post.tsの作成（セットアップ処理）
- [x] src/api/v1/playground/get.tsの作成（Playground画面）
- [ ] HTMLテンプレートの作成（setup.html、playground.html）

### 1.4 エラーハンドリング基盤
- [ ] src/utils/errors.tsの作成（カスタムエラークラス）
- [ ] src/middleware/request-id.tsの作成（リクエストID生成）
- [ ] src/middleware/logging.tsの作成（リクエストログ）
- [ ] 統一エラーレスポンス形式の実装

## Phase 2: 認証・認可

### 2.1 Auth0統合
- [ ] src/services/auth0.tsの作成（Auth0サービス）
- [ ] src/api/auth/login/get.tsの作成（ログインリダイレクト）
- [ ] src/api/auth/callback/get.tsの作成（Auth0コールバック）
- [ ] src/api/auth/logout/post.tsの作成（ログアウト）
- [ ] src/api/auth/me/get.tsの作成（現在のユーザー情報）
- [ ] Auth0設定の環境変数対応

### 2.2 セッション管理
- [ ] src/services/session.tsの作成（セッション管理）
- [ ] src/middleware/auth.tsの作成（認証ミドルウェア）
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

### 5.1 ファイルアップロード（R2/Google Drive）
- [ ] src/api/files/upload/post.tsの作成（アップロード）
- [ ] src/api/files/$fileId/get.tsの作成（ダウンロード）
- [ ] src/api/files/$fileId/delete.tsの作成（削除）
- [ ] src/services/storage/r2.tsの作成（R2ストレージ）
- [ ] src/services/storage/google-drive.tsの作成（Driveストレージ）
- [ ] _Fileシートのメタデータ管理

### 5.2 OpenAPI仕様書生成
- [ ] src/api/docs/get.tsの作成（OpenAPIドキュメント）
- [ ] src/utils/openapi-generator.tsの作成
- [ ] 各APIエンドポイントのスキーマ定義
- [ ] Swagger UIの統合

### 5.3 Playground UI
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