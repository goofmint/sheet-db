SheetDB設計書
1. 概要

目的: GoogleシートをバックエンドとするBaaS（OSS とクラウド）
  •  メインサイト: sheetdb.app（LP、ドキュメント）
  •  デモ/プレイグラウンド: demo.sheetdb.app（API動作確認、Playground、初期設定ウィザード）
  •  セットアップウィザード（設定がない場合のみ）: demo.sheetdb.app/setup

2. デプロイ構成
  •  Cloudflare Workers + Hono
  •  sheetdb.app React Router
  •  demo.sheetdb.app（デモ/セットアップ/Playground） Cloudflare Workers + Hono
  •  データ/状態管理（Cloudflare側）:
  •  D1: 設定情報・セッション
  •  KV: キャッシュ（TTL付き）
  •  Google Sheets
  •  ファイルストレージ: Google Drive または S3互換サービス

3. Googleシートについて
  •  シート構造ルール:
  •  1行目: ヘッダー（カラム名）
  •  2行目: カラムメタデータ（JSON文字列）
  •  保存形式: 各カラムの2行目セルに、そのカラム専用のJSON文字列を格納する
  •  複数カラムに分割せず、1セル=1JSONとする（シート内で同一形式を必須）
  •  JSONはUTF-8のプレーンテキスト。ダブルクォートでキー/文字列を囲む
  •  ネストオブジェクト/配列はJSON標準に従い、1セル内にそのまま埋め込む
  •  文字列内のダブルクォートはバックスラッシュでエスケープする（\"）
  •  空セルはメタデータ未指定として扱う（既定値で処理）
  •  例:
  •  A1: id / A2: {"type":"string","required":true,"unique":true}
  •  B1: user_name / B2: {"type":"string","required":true,"unique":true,"format":"^[a-z0-9_]+$"}
  •  C1: profile / C2: {"type":"object","default":{"nickname":"demo","tags":["alpha","beta"]}}
  •  D1: note / D2: {"type":"string","default":"He said \\\"hi\\\""}
  •  検証: 2行目はJSONとしてパース可能であること。無効なJSONはバリデーションエラー
  •  型、デフォルト、最大値・最小値、入力規則（正規表現）、必須
  •  3行目以降: データ行
  •  行レベルACL
  •  認証は _Users シートを起点に実施
  •  行レベルアクセス制御（Row-Level ACL）は以下のフィールドを利用
  •  _public_read, _public_write (真偽値）
  •  _role_read, _role_write （許可するグループ名をカンマ区切りで指定）
  •  _user_read, _user_write （許可するユーザーIDをカンマ区切りで指定）
  •  マスターキー: ACLを無視してアクセス可能。HTTPヘッダーに適用する

データの作成、更新時には2行目の定義（型、デフォルト、バリデーション等）を利用する。

4. 初期設定ウィザード（demo.sheetdb.app/setup）

対象Googleシートとストレージを紐づけ、管理者認証とマスターキーを確立し、稼働可能な状態にする

4.2 入力項目

  1.  Googleシートの選択
Google認証後、対象スプレッドシートIDを画面で選択
  2.  管理者アカウント
管理者ID/パスワードを設定（初期 _Users に反映）
  1.  ファイルストレージ選択
  1.  Google Drive:
保存先 フォルダID を指定
  2.  S3互換:
エンドポイント / アクセスキー / シークレット / バケット 等を指定
  1.  マスターキー設定

4.3 セットアップ時の自動生成（Googleシート側）

Googleシート選択時、以下のシートが存在しなければ作成します。
  •  _Users（認証情報）
  •  _Roles（グループ/ロール情報）
  •  _Files（ファイルメタ情報）


5. データモデル（Google Sheets）

5.1 _Users

  •  id: string, required, unique
  •  user_name: string, required, unique
  •  hashed_password: string, required (bcrypt or Argon2 hash with per-user salt)
  •  locked_at: date
  •  email: email
  •  confirmed_at: date
  •  confirm_key: string
  •  created_at: date, required
  •  updated_at: date, required
  •  パスワード運用:
  •  APIは作成/更新時のみ平文パスワードを受け取り、必ずサーバー側でハッシュ化して保存
  •  ソルトはbcrypt/Argon2の標準フォーマットに含めて保存（別カラム不要）
  •  パスワード/ハッシュはログ出力やレスポンスに含めない

5.2 _Roles

  •  name: string, required, unique
  •  users: array: required, default = []
  •  created_at: date, required
  •  updated_at: date, required

5.3 _Files

  •  id: string, required, unique
  •  name : string, required, unique
  •  url : string, required, unique
  •  size: number, required, default = 0
  •  content_type: string, required
  •  created_at : date, required
  •  updated_at : date, required
  •  public_read: boolean, required, default = true
  •  public_write : boolean, required, default = false
  •  roles_read: array, required, default = []
  •  roles_write : array, required, default = []
  •  users_read : array, required, default = []
  •  users_write : array, required, default = []

5.4 その他のシート

APIでデータ作成する際に、シートがなければ自動で作成する
その際には以下のフィールドをデフォルトで作成する

  •  id : string, required, unique
  •  created_at : date, required
  •  updated_at : date, required
  •  public_read: boolean, required, default = true
  •  public_write : boolean, required, default = false
  •  roles_read: array, required, default = []
  •  roles_write : array, required, default = []
  •  users_read : array, required, default = []
  •  users_write : array, required, default = []

5.1 シート命名制約
  •  ユーザー作成シート名: 英数字 + アンダースコア のみ
  •  _ プレフィックスは予約（システム用）のため、利用不可

5.2 既定シートの役割
  •  _Users
  •  ユーザー識別子、パスワードハッシュ等の認証情報
  •  セッション連携の主体
  •  _Roles
  •  ロール（グループ）定義、ユーザーとの紐づけ
  •  _Files
  •  ファイルID、保存先（Drive/S3）、オブジェクトキー、サイズ、MIME、作成者などのメタ情報

5.3 行レベルACL（Row Data）
  •  各データ行にACL関連カラムを持ち、読み書き可否を判定します。
  •  ACLの評価順序はpublic → role → user

利用できる型

  •  string
  •  number
  •  boolean
  •  date
  •  array
  •  object
  •  formula
  •  formulaの扱い:
  •  Google Sheets 内の計算式（先頭が`=`の文字列）をセルに保存する
  •  評価はGoogle Sheets側で実行し、サーバー側では式の計算を行わない
  •  APIの読み取りは計算結果のみを返す（式文字列は返さない）
  •  APIの書き込み（POST/PUT/PATCH）はformula型カラムに式文字列の更新を許可する
  •  利用可能な関数/演算子はGoogle Sheets標準に準拠（カスタム関数は非対応）
  •  依存関係/循環参照はGoogle Sheetsの挙動に従う（エラー値はそのまま返す）
  •  例:
  •  セル値: "=A1+B1"
  •  JSON入力: {"sum":"=A1+B1"} / JSON出力: {"sum":3}
  •  JSON入力（文字列内クォート）: {"flag":"=IF(A1=\\\"yes\\\",1,0)"}
  •  検証: 無効な式は書き込み時にバリデーションエラーとして返す

2行目で指定できる情報

  •  必須
  •  ユニーク
  •  型
  •  フォーマット(正規表現)
  •  最小値
  •  最大値
  •  デフォルト

6. Cloudflare側データモデル

6.1 D1（必須テーブル）
  •  Configs
  •  初期設定ウィザードで設定するもの
  •  Google APIキー
  •  スプレッドシートID
  •  ストレージ種別（Google Drive or S3 API)
  •  ストレージキー（Google DriveのフォルダID、またはS3 API情報）
  •  マスターキー
  •  その後の設定画面で変更できるもの
  •  API経由でシート作成を許可するか否か（真偽値。デフォルトtrue）
  •  API経由でのデータ作成を拒否するシート名(カンマ区切り。デフォルト空文字)
  •  API経由でのデータ更新を拒否するシート名(カンマ区切り。デフォルト空文字)
  •  API経由でのデータ削除を拒否するシート名(カンマ区切り。デフォルト空文字)
  •  最大のレスポンス件数（デフォルト1000）
  •  最大の認証失敗回数（デフォルト5）
  •  メールの確認必須にするかどうか（真偽値。デフォルトTrue）
  •  キャッシュTTL（デフォルト3600。秒数）
  •  メール設定（SMTPサーバー、ユーザー名、パスワード、ポート番号）
  •  匿名ユーザーの有効無効（デフォルトFalse）
  •  マックスファイルサイズ（デフォルト10。メガバイト指定）
  •  セッションTTL（86400。秒数）
  •  Sessions
  •  session_id
  •  user_id
  •  expired_at: 有効期限（設定のセッションTTLに依存）

6.2 KV（キャッシュ方針）

有効期限は60分

7. API処理フロー

7.1 Read（GET）

  1.  認証（オプション）
  2.  KVから取得
  3.  キャッシュが存在しない・有効期限切れの場合、シートからデータ取得＆KVにキャッシュ
  4.  ACL評価（行単位）
  5.  1レスポンスの上限設定によってデータカット・ページング適用
  6.  レスポンス

7.2 Write（POST/PUT/PATCH/DELETE）

  1.  認証（オプション）
  2.  ACL評価（書き込み）
  3.  Googleシートへ反映
  4.  バックグラウンドジョブでキャッシュ再生成
  5.  レスポンス
