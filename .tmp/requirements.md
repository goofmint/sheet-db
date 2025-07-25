# 要件定義書 - GoogleシートバックエンドAPIサービス「sheetDB」

## 1. 目的

GoogleシートをデータベースとしてREST APIを提供するBaaS（Backend-as-a-Service）プラットフォームを構築する。ユーザーは既存のGoogleシートをそのまま活用しながら、モダンなAPI経由でデータにアクセスできるようになる。

## 2. 機能要件

### 2.1 必須機能

- [ ] **Google Sheets連携**
  - Googleアカウント認証（OAuth2）
    - 複数アカウント連携可能（Sheet APIのリミットがあるため）
  - シートの選択・管理
    - 1シートのみを対象とする（複数シートのサポートは将来の拡張として検討）
  - シートの読み込み・書き込み権限の管理
    - 読み書きは行ごとのACL管理
      - public_read: boolean (trueなら誰でも読み取り可能（認証不要）)
      - public_write: boolean （trueなら誰でも書き込み可能（認証不要））
      - user_read: string[] (ユーザーIDの配列、読み取り権限を持つユーザー)
      - user_write: string[] (ユーザーIDの配列、書き込み権限を持つユーザー)
      - role_read: string[] (ロール名の配列、読み取り権限を持つロール)
      - role_write: string[] (ロール名の配列、書き込み権限を持つロール)
  - シートの自動生成
    - 条件
      - シートが存在しない場合は自動で作成
        - Configテーブルで allow_create_table が true の場合のみ自動生成
        - さらに allow_create_users に、該当ユーザーIDが含まれているか、
          または allow_create_roles に、自分の所属ロールが含まれている場合のみ自動生成
      - デフォルトのカラムとデータ型を設定
    - デフォルトのカラム（1行目）
      - id: string (UUID形式)
      - created_at: timestamp = CURRENT_TIMESTAMP
      - updated_at: timestamp = CURRENT_TIMESTAMP
      - public_read: boolean = true
      - public_write: boolean = false
      - user_read: string[] = []
      - user_write: string[] = []
      - role_read: string[] = []
      - role_write: string[] = []
    - デフォルトのデータ型、制約（2行目に記述）
      - id: string, required, unique
      - created_at: timestamp, default CURRENT_TIMESTAMP
      - updated_at: timestamp, default CURRENT_TIMESTAMP
      - public_read: boolean, default true
      - public_write: boolean, default false
      - user_read: string[], default []
      - user_write: string[], default []
      - role_read: string[], default []
      - role_write: string[], default []
    - 2行目でヘッダー固定
      - 以降の行はデータとして扱う
    - 制約の種類
      - 必須（required）
      - 一意（unique）
      - デフォルト値（default）
      - 入力制約（pattern）
      - 入力最小値（min）
      - 入力最大値（max）

- [ ] **REST API機能**
  - CRUD操作（Create, Read, Update, Delete）
  - クエリパラメータによるフィルタリング、ソート
  - ページネーション
  - OpenAPI仕様書の自動生成

- [ ] **認証・認可**
  - Auth0によるユーザー認証
  - アクセス権限管理（読み取り、読み書き）

- [ ] **キャッシュ機能**
  - D1データベースでのキャッシュ管理
  - デフォルト10分のキャッシュ（Configテーブルで設定可能）
  - 期限切れ時のバックグラウンド更新

- [ ] **データ同期**
  - 読み取り時：キャッシュ優先、ミス時はGoogleシートから取得
  - 書き込み時：直接Googleシートに書き込み後、キャッシュ更新

- [ ] **ファイルストレージ**
  - Cloudflare R2とGoogle Driveの選択的サポート
  - アップロード・ダウンロードAPI

## 3. 非機能要件

### 3.1 保守性

- TypeScriptによる型安全性
- 包括的なユニットテスト・統合テスト
  - スキップの禁止
  - モック定義、利用の禁止
- エラーハンドリングの統一化
- ログの構造化と可視化

### 3.1 互換性

- REST API標準への準拠
- OpenAPI 3.0仕様のサポート
- 主要なHTTPクライアントライブラリとの互換性

## 4. 制約事項

### 4.1 技術的制約

- **プラットフォーム**: Cloudflare Workers（エッジコンピューティング）
- **データベース**: Cloudflare D1（SQLite互換）
- **ランタイム**: TypeScript/Node.js互換環境
- **フレームワーク**: Hono（軽量Webフレームワーク）
- **認証**: Auth0のみサポート
- **バックエンド**: Google Sheets API (googleapisパッケージを利用)

### 4.2 ビジネス制約

- Google Sheets APIのレート制限への対応
  - 複数アカウントを利用したリクエスト分散
- Cloudflare Workersの実行時間制限（30秒）
- D1データベースのサイズ制限

## 5. 成功基準

### 5.1 完了の定義

- [ ] Googleシートの読み書きができるREST APIの実装
- [ ] Auth0による認証・認可の実装
- [ ] キャッシュ機能によるパフォーマンス最適化
- [ ] 全機能に対する自動テストの実装
- [ ] OpenAPI仕様書の自動生成
- [ ] デプロイメントパイプラインの構築

### 5.2 受け入れテスト

- 実際のGoogleシートに対してCRUD操作が正常に動作
- Auth0認証はキャッシュしてテストに利用する
- 認証されたユーザーのみがAPIにアクセス可能
- キャッシュが有効に機能する
- 同時アクセス時のデータ整合性が保たれる

## 6. 想定されるリスク

- **Auth0の認証制限**
  - 対策：テスト時には、最初にAuth0の認証をキャッシュ（静的ファイル化）して利用する
- **Google Sheets APIの制限**
  - 対策：適切なキャッシュ戦略とレート制限の実装
  - Google Sheets APIへのアクセスを特定のファイルに限定し、オプションでwaitを入れられるようにする
- **大量データの処理**
  - 対策：ページネーションとストリーミング処理の実装

## 7. フォルダ・ファイル構成

アプリケーションを構成するファイルやフォルダはすべて src 以下にあるものとします。

### ファイル構成の例

- GET /api/sheets/{sheetId}
  src/api/sheets/$sheetId/get.ts
- POST /api/sheets/{sheetId}/columns
  src/api/sheets/$sheetId/columns/post.ts
- PUT /api/sheets/{sheetId}/columns/{columnName}
  src/api/sheets/$sheetId/columns/$columnName/put.ts
- GET /api/sheets/{sheetId}/columns
  src/api/sheets/$sheetId/columns/get.ts

#### ルーティングの注意点

/src/api/*/index.ts で、配下にあるファイルを読み込み、  `app.route('/api/<route>', handler)` のようにルーティングを定義します。

### D1データベースのモデル

- src/models/config.ts
- src/models/session.ts
- src/models/cache.ts

### Googleシートのモデル

- src/sheets/user.ts
- src/sheets/role.ts
- src/sheets/data.ts （その他のシート）

### 外部サービス

- src/services/sheetService.ts
- src/services/auth0Service.ts

## 8. 設定情報

Configテーブルに以下の設定項目を追加します。これらは初期インストール時に設定、または管理者が後から変更可能です。変更時には `config_password` を使用して認証します。

- google_client_id : Google OAuth2クライアントID
- google_client_secret : Google OAuth2クライアントシークレット
- google_access_tokens : Google APIアクセストークン（複数設定可能。トークン、アクセス期限、スコープ、リフレッシュトークンを含む）
- sheet_setup_status : シートのセットアップステータス
- sheets_initialized : シートが初期化されたかどうか
- sheet_setup_progress : シートのセットアップ進捗
- spreadsheet_id : 対象のGoogleスプレッドシートID
- spreadsheet_name : 対象のGoogleスプレッドシート名
- spreadsheet_url : 対象のGoogleスプレッドシートURL
- master_key : マスターキー（APIアクセス用）
- config_password : Config設定用のパスワード
- auth0_domain : Auth0のドメイン
- auth0_client_id : Auth0のクライアントID
- auth0_client_secret : Auth0のクライアントシークレット
- setup_completed : セットアップが完了したかどうか
- upload_destination : ファイルアップロードの保存先（r2またはgoogle_drive）
- google_drive_folder_id : Google DriveのフォルダID（アップロード先）
- cache_expiration : キャッシュの有効期限（秒単位、デフォルトは600秒）
- allow_create_table : シートの自動生成を許可するかどうか（デフォルトはfalse）
- allow_modify_table : シートのスキーマ更新を許可するかどうか（デフォルトはfalse）
- allow_delete_table : シートの削除を許可するかどうか（デフォルトはfalse）
- allow_create_users : シートの作成ができるユーザーのIDの配列（デフォルトは []）
- allow_create_roles : シートの作成ができるロールの配列（デフォルトは []）
- allow_modify_users : シートのスキーマ変更ができるユーザーのIDの配列（デフォルトは []）
- allow_modify_roles : シートのスキーマ変更ができるロールの配列（デフォルトは []）
- allow_delete_users : シートの削除ができるユーザーのIDの配列（デフォルトは []）
- allow_delete_roles : シートの削除ができるロールの配列（デフォルトは []）

## 9. コーディングの注意点

すべてのコードは以下のルールに従って記述します。

- すべて英語
- TypeScriptのエラーを無視しない
- 型安全を重視
- モック定義、利用はしない
- テストのスキップは禁止
- エラーハンドリングは必ず行う

## 10. ルーティング

- GET /
  - 未セットアップ -> `/setup` へのリダイレクト
  - セットアップ済み -> `/playground` へのリダイレクト
- GET /setup
  - セットアップ画面を表示
- POST /setup
  - セットアップ情報を受け取り、Configテーブルに保存
  - セットアップ完了後、`/playground` へリダイレクト
- GET /playground
  - APIのテスト用画面を表示
- /api 以下
  - 各APIエンドポイントを定義
  - 認証が必要なエンドポイントはAuth0で保護
- GET /docs
  - OpenAPI仕様書を表示
- GET /health
  - ヘルスチェックエンドポイント
