# Google Cloud Console セットアップガイド

Sheet DBでGoogleスプレッドシートを使用するために必要なGoogle Cloud Consoleの設定手順です。

## 1. Google Cloud Console プロジェクトのセットアップ

### 1.1 プロジェクトの作成
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成または既存プロジェクトを選択

### 1.2 必要なAPIの有効化
以下のAPIを有効にしてください：

- **Google Sheets API**
  - スプレッドシートの読み書きに必要
  - URL: `https://console.cloud.google.com/apis/library/sheets.googleapis.com`

- **Google Drive API**
  - ファイルリストの取得、スプレッドシートへのアクセス権限確認に必要
  - URL: `https://console.cloud.google.com/apis/library/drive.googleapis.com`

## 2. OAuth 2.0 認証情報の設定

### 2.1 OAuth同意画面の設定
1. `APIs & Services` → `OAuth consent screen`
2. **User Type**: External（一般ユーザー向け）または Internal（組織内のみ）
3. 必要な情報を入力：
   - アプリ名
   - ユーザーサポートメール
   - デベロッパーの連絡先情報

### 2.2 OAuth クライアントIDの作成
1. `APIs & Services` → `Credentials`
2. `Create Credentials` → `OAuth 2.0 Client IDs`
3. **Application type**: Web application
4. **Authorized redirect URIs** に以下を追加：
   ```
   https://your-domain.com/auth/callback
   ```
   - 開発環境の場合: `http://localhost:8787/auth/callback`
   - 本番環境の場合: 実際のドメインを使用

## 3. 権限スコープ

Sheet DBが要求するGoogleのスコープ：

- `https://www.googleapis.com/auth/spreadsheets`
  - Googleスプレッドシートの読み書き権限
- `https://www.googleapis.com/auth/drive.readonly`
  - Google Driveのファイル一覧取得（読み取り専用）

## 4. 環境変数の設定

### 4.1 Cloudflare Workersでの設定

#### 本番環境（Secretsとして設定）
```bash
# Client IDを設定
npx wrangler secret put GOOGLE_CLIENT_ID

# Client Secretを設定  
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

#### 開発環境（.dev.varsファイル）
プロジェクトルートに `.dev.vars` ファイルを作成：

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

### 4.2 wrangler.jsonc での環境変数参照
```jsonc
{
  "name": "sheet-db",
  "main": "src/index.ts", 
  // 他の設定...
  "vars": {
    // 必要に応じて非機密の環境変数を設定
  }
}
```

## 5. セキュリティ考慮事項

### 5.1 CSRF対策
- OAuth流れでstateパラメータを使用してCSRF攻撃を防ぐ
- stateは一意の値を生成し、セッションで管理

### 5.2 リダイレクトURI検証
- 認証後のリダイレクト先が正当なものか検証
- 承認済みリダイレクトURIのみを使用

### 5.3 アクセストークンの管理
- アクセストークンは適切に暗号化して保存
- 必要以上に長期間保持しない
- リフレッシュトークンを使用して定期的に更新

## 6. トラブルシューティング

### よくあるエラー

1. **`redirect_uri_mismatch`**
   - Google Cloud ConsoleのOAuth設定でリダイレクトURIが正しく設定されていない

2. **`invalid_client`**
   - Client IDまたはClient Secretが間違っている

3. **`access_denied`**
   - ユーザーが権限を拒否した
   - スコープが正しく設定されていない可能性

### デバッグ方法
- Google Cloud Consoleの「APIs & Services」→「Credentials」で設定を確認
- ブラウザの開発者ツールでネットワークタブを確認
- Cloudflare Workersのログを確認

## 7. 参考リンク

- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Google Drive API Documentation](https://developers.google.com/drive/api)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)