# Sheet DB

このアプリケーションは、GoogleスプレッドシートをBaaS（Backend as a Service）として利用するためのものです。

## 機能

Sheet DBはGoogleスプレッドシートをJSON APIで操作します。主な機能は以下の通りです。

- 認証
- データベース
- ファイルストア
  - R2
  - Google Drive
- ACL

データ取得についてはD1に対してキャッシュします。キャッシュの期限は10分で、データをバックグラウンドで更新します。

データの作成、更新、削除については処理をキューに入れて、バックエンドで処理します。処理結果はWebSocketで通知します。

認証はAuth0のみサポートします。

## アーキテクチャ

- Cloudflare Workers
- Cloudflare D1
- Cloudflare R2
- TypeScript
- Hono
- Drizzle
