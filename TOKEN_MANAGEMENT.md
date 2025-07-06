# Google Token Management

このドキュメントでは、Sheet DBでGoogleトークンの継続的な利用と管理について説明します。

## 概要

Sheet DBはGoogle OAuth2.0を使用してGoogleスプレッドシートにアクセスします。認証情報とアクセストークンはConfigテーブルに安全に保存され、自動的にリフレッシュされます。

## Configテーブルに保存される情報

### Google OAuth認証情報
- `google_client_id`: Google OAuth Client ID
- `google_client_secret`: Google OAuth Client Secret

### Google アクセストークン
- `google_access_token`: 現在のアクセストークン
- `google_refresh_token`: リフレッシュトークン（長期保存）
- `google_token_expires_at`: トークンの有効期限（Unix timestamp）
- `google_token_scope`: 承認されたスコープ

### その他の設定
- `google_auth_completed`: 認証完了フラグ
- `oauth_state_*`: CSRF防止用の一時的なstateデータ

## API エンドポイント

### 1. POST /connects
Google OAuth認証フローを開始します。

**リクエスト:**
```json
{
  "clientId": "your-google-client-id",
  "clientSecret": "your-google-client-secret"
}
```

**レスポンス:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "csrf-protection-uuid"
}
```

**処理内容:**
1. Google認証情報をConfigテーブルに保存
2. OAuth認証URLを生成
3. CSRF防止用のstateを保存

### 2. GET /auth/callback
Google OAuth認証完了後のコールバック処理を行います。

**処理内容:**
1. stateパラメータでCSRF攻撃を防止
2. 認証コードをアクセストークンに交換
3. アクセストークンとリフレッシュトークンをConfigテーブルに保存
4. 認証完了フラグを設定

### 3. POST /auth/refresh
手動でアクセストークンをリフレッシュします。

**レスポンス:**
```json
{
  "success": true,
  "expires_in": 3600
}
```

### 4. GET /api/token
有効なアクセストークンを取得します（内部API用）。

**レスポンス:**
```json
{
  "access_token": "ya29.xxxxx",
  "expires_in": 3595,
  "scope": "https://www.googleapis.com/auth/spreadsheets ..."
}
```

**処理内容:**
1. トークンの有効性を確認
2. 無効な場合は自動的にリフレッシュ
3. 有効なトークンを返却

## トークン管理フロー

### 初回認証
1. ユーザーが `/setup` でGoogle認証情報を入力
2. `POST /connects` でOAuth認証フローを開始
3. ユーザーがGoogleで認証を完了
4. `/auth/callback` でトークンを取得・保存

### 継続利用
1. アプリケーションが `GET /api/token` を呼び出し
2. システムが自動的にトークンの有効性をチェック
3. 必要に応じて自動的にリフレッシュ
4. 有効なトークンを返却

### トークンリフレッシュ
- アクセストークンの有効期限: 通常1時間
- リフレッシュトークンの有効期限: 6ヶ月（使用されない場合）
- 自動リフレッシュ: トークン有効期限の5分前からリフレッシュ可能

## セキュリティ考慮事項

### 1. CSRF対策
- OAuth認証時にstateパラメータを使用
- stateは一意のUUIDを生成し、Configテーブルで管理

### 2. トークンの暗号化
- Configテーブルには平文で保存されるため、D1データベースレベルでの暗号化を推奨
- 本番環境では適切なアクセス制御を実装

### 3. トークンの期限管理
- アクセストークンは短期間（1時間）で自動更新
- リフレッシュトークンは長期間有効だが、定期的な再認証を推奨

## ヘルパー関数

### saveGoogleCredentials(db, credentials)
Google OAuth認証情報をConfigテーブルに保存

### getGoogleCredentials(db)
保存されたGoogle OAuth認証情報を取得

### saveGoogleTokens(db, tokens)
Google アクセストークンとリフレッシュトークンを保存

### getGoogleTokens(db)
保存されたGoogleトークンを取得

### isTokenValid(db)
アクセストークンの有効性をチェック

### exchangeCodeForTokens(code, redirectUri, credentials)
認証コードをアクセストークンに交換

### refreshAccessToken(refreshToken, credentials)
リフレッシュトークンを使用してアクセストークンを更新

## エラーハンドリング

### よくあるエラーと対処法

1. **`No refresh token available`**
   - 原因: リフレッシュトークンが保存されていない
   - 対処: 再認証が必要

2. **`Token refresh failed`**
   - 原因: リフレッシュトークンが無効
   - 対処: 再認証が必要

3. **`Authentication required`**
   - 原因: トークンが存在しないまたは無効
   - 対処: `/setup` から認証フローを開始

4. **`Invalid state parameter`**
   - 原因: CSRF攻撃またはセッション期限切れ
   - 対処: 認証フローを最初からやり直し

## 使用例

### Google Sheets APIの呼び出し
```javascript
// 有効なトークンを取得
const tokenResponse = await fetch('/api/token');
const tokenData = await tokenResponse.json();

// Google Sheets APIを呼び出し
const sheetsResponse = await fetch(
  'https://sheets.googleapis.com/v4/spreadsheets/SPREADSHEET_ID/values/A1:Z100',
  {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    }
  }
);
```

## 設定確認

### Configテーブルの内容確認
```sql
-- 保存されている設定を確認
SELECT name, value FROM Config WHERE name LIKE 'google_%';

-- 認証完了ステータス確認
SELECT value FROM Config WHERE name = 'google_auth_completed';
```

## 注意事項

1. **リフレッシュトークンの管理**
   - リフレッシュトークンは一度だけ発行される
   - 失われた場合は再認証が必要

2. **スコープの変更**
   - 必要な権限が変更された場合は再認証が必要
   - 既存のトークンでは新しいスコープにアクセスできない

3. **レート制限**
   - Google APIには使用量制限がある
   - 適切なエラーハンドリングとリトライ機能を実装推奨