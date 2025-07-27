# Setup UI設計書

## 概要
初回セットアップ用のHTMLインターフェースを提供するWebページエンドポイントの設計書

## エンドポイント
`GET /api/v1/setup`

## 目的
- 初回セットアップのためのユーザーフレンドリーなWebUI提供
- Google OAuth、Auth0、アプリケーション設定の入力フォーム
- セットアップ状態の表示と完了確認
- 設定値の検証とエラー表示

## レスポンス仕様

### セットアップ未完了時 (200)
```
Content-Type: text/html; charset=utf-8
```

HTMLページを返却し、以下の機能を提供：

#### 1. セットアップフォーム
- Google OAuth設定入力
  - Client ID入力フィールド
  - Client Secret入力フィールド
- Googleシート選択モーダル
  - シート一覧表示
  - シート選択ボタン
- シート初期化機能
  - Userシートの作成
  - Roleシートの作成
  - 作成状態のステータス表示
  - 再試行ボタン
- Auth0設定入力
  - Domain入力フィールド
  - Client ID入力フィールド
  - Client Secret入力フィールド
- アプリケーション設定
  - Config Password入力フィールド
- ファイルストレージ設定
  - Google DriveまたはR2の選択
  - Google Driveの場合はフォルダの選択モーダル、またはフォルダIDの入力フィールド

#### 2. セットアップ保存
- フォーム送信ボタン
- 送信中のローディング表示
- 成功・失敗の結果表示
  - 成功時はPlayground画面へのリンク表示&リダイレクト（3秒後）

### セットアップ完了時 (200)
セットアップが完了している場合：

#### 1. Config Password入力
- 設定パスワード入力フィールド
- GET /api/v1/setupを呼び出して、結果が取得できれば成功
- 設定パスワードが間違っている場合はエラー表示

#### 2. 設定状態表示
- 現在の設定値の表示（入力状態で）
- 各設定項目の状態確認
- 最終更新日時

#### 3. ナビゲーション
- Playground画面へのリンク
- API情報へのリンク

## HTML構造設計

### ページレイアウト
```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <title>SheetDB Setup</title>
    <style>/* CSS styling */</style>
</head>
<body>
    <header>
        <h1>SheetDB セットアップ</h1>
        <div class="setup-status">/* セットアップ状態表示 */</div>
    </header>
    
    <main>
        <section class="setup-form">/* セットアップフォーム */</section>
        <section class="instructions">/* 設定手順説明 */</section>
        <section class="status-display">/* 設定状態表示 */</section>
    </main>
    
    <script>/* JavaScript機能 */</script>
</body>
</html>
```

### セットアップフォーム構造
```html
<form id="setup-form" class="setup-form">
  <div class="section google-section">
    <h2>Google OAuth設定</h2>
    <div class="field-group">
      <label for="google-client-id">Client ID *</label>
      <input 
        type="text" 
        id="google-client-id" 
        name="google.clientId"
        placeholder="your-project.apps.googleusercontent.com"
        required
      />
      <div class="field-error" id="google-client-id-error"></div>
    </div>
    
    <div class="field-group">
      <label for="google-client-secret">Client Secret *</label>
      <input 
        type="password" 
        id="google-client-secret" 
        name="google.clientSecret"
        placeholder="GOCSPX-..."
        required
      />
      <div class="field-error" id="google-client-secret-error"></div>
    </div>
  </div>

  <div class="section auth0-section">
    <h2>Auth0設定</h2>
    <div class="field-group">
      <label for="auth0-domain">Domain *</label>
      <input 
        type="text" 
        id="auth0-domain" 
        name="auth0.domain"
        placeholder="your-domain.auth0.com"
        required
      />
      <div class="field-error" id="auth0-domain-error"></div>
    </div>
    
    <div class="field-group">
      <label for="auth0-client-id">Client ID *</label>
      <input 
        type="text" 
        id="auth0-client-id" 
        name="auth0.clientId"
        placeholder="32文字のClient ID"
        required
      />
      <div class="field-error" id="auth0-client-id-error"></div>
    </div>
    
    <div class="field-group">
      <label for="auth0-client-secret">Client Secret *</label>
      <input 
        type="password" 
        id="auth0-client-secret" 
        name="auth0.clientSecret"
        placeholder="48文字以上のClient Secret"
        required
      />
      <div class="field-error" id="auth0-client-secret-error"></div>
    </div>
  </div>

  <div class="section app-section">
    <h2>アプリケーション設定</h2>
    <div class="field-group">
      <label for="config-password">設定パスワード *</label>
      <input 
        type="password" 
        id="config-password" 
        name="app.configPassword"
        placeholder="8文字以上、大文字・小文字・数字を含む"
        required
      />
      <div class="field-error" id="config-password-error"></div>
      <div class="field-help">
        このパスワードは設定変更時の認証に使用されます
      </div>
    </div>
  </div>


  <div class="form-actions">
    <button type="submit" class="primary-button" id="submit-button">
      セットアップ実行
    </button>
    <div class="loading-indicator" id="loading" style="display: none;">
      設定中...
    </div>
  </div>
</form>
```

## 機能要件

### 1. フォーム検証
#### クライアントサイド検証
- 必須フィールドの入力確認
- フォーマット検証（URL、メール等）
- リアルタイムエラー表示

#### サーバーサイド検証
- POST /api/v1/setupへのリクエスト送信
- バリデーションエラーの返却
- 成功時のレスポンス

### 2. ユーザビリティ機能
- 各設定項目の説明とヘルプテキスト
- パスワード表示/非表示の切り替え

### 3. セキュリティ機能
- 機密情報の適切な表示制御
- XSS攻撃の防止

### 4. レスポンシブ対応
- モバイルデバイス対応
- タブレット表示の最適化
- デスクトップでの見やすいレイアウト

## JavaScript機能

### 1. フォーム管理
```javascript
class SetupForm {
  constructor() {
    this.form = document.getElementById('setup-form');
    this.submitButton = document.getElementById('submit-button');
    this.loadingIndicator = document.getElementById('loading');
    
    this.initializeValidation();
    this.initializeSubmission();
  }

  initializeValidation() {
    // リアルタイム検証の実装
    const fields = this.form.querySelectorAll('input[required]');
    fields.forEach(field => {
      field.addEventListener('blur', () => this.validateField(field));
      field.addEventListener('input', () => this.clearFieldError(field));
    });
  }

  async submitForm(formData) {
    try {
      const response = await fetch('/api/v1/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        this.showSuccess();
        setTimeout(() => window.location.reload(), 2000);
      } else {
        const errorData = await response.json();
        this.showErrors(errorData.error);
      }
    } catch (error) {
      this.showNetworkError(error);
    }
  }
}
```

### 2. バリデーション機能
```javascript
const validators = {
  'google.clientId': (value) => {
    if (!value.endsWith('.googleusercontent.com')) {
      return 'Google Client IDの形式が正しくありません';
    }
    return null;
  },
  
  'auth0.domain': (value) => {
    if (!/^[a-zA-Z0-9-]+\.(auth0\.com|[a-z]{2}\.auth0\.com)$/.test(value)) {
      return 'Auth0ドメインの形式が正しくありません';
    }
    return null;
  },
  
  'auth0.clientId': (value) => {
    if (value.length !== 32) {
      return 'Auth0 Client IDは32文字である必要があります';
    }
    return null;
  },
  
  'auth0.clientSecret': (value) => {
    if (value.length < 48) {
      return 'Auth0 Client Secretは48文字以上である必要があります';
    }
    return null;
  },
  
  'app.configPassword': (value) => {
    const errors = [];
    if (value.length < 8) errors.push('8文字以上');
    if (!/[A-Z]/.test(value)) errors.push('大文字を含む');
    if (!/[a-z]/.test(value)) errors.push('小文字を含む');
    if (!/[0-9]/.test(value)) errors.push('数字を含む');
    
    return errors.length > 0 ? `パスワードは${errors.join('、')}必要があります` : null;
  }
};
```

## CSS スタイリング

### デザインテーマ
- モダンなフラットデザイン
- ダークテーマ対応
- アクセシビリティ配慮
- Material Design風のインタラクション

### レスポンシブブレイクポイント
```css
/* Mobile First */
.setup-form {
  padding: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .setup-form {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .setup-form {
    max-width: 800px;
    padding: 3rem;
  }
  
  .form-sections {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }
}
```

## エラーハンドリング

### 予期されるエラー
1. **バリデーションエラー** (400)
   - フィールド固有のエラー表示
   - 問題のあるフィールドのハイライト

2. **認証エラー** (401)
   - 既にセットアップ済みの場合のパスワード要求

3. **サーバーエラー** (500)
   - 設定保存失敗時の適切なエラーメッセージ

4. **ネットワークエラー**
   - 接続失敗時の再試行オプション

### エラー表示例
```html
<div class="error-message">
  <span class="error-icon">❌</span>
  <span class="error-text">設定の保存に失敗しました。もう一度お試しください。</span>
  <button class="retry-button">再試行</button>
</div>
```

## テスト要件

### 統合テスト
- HTMLレスポンスの返却確認
- セットアップ状態による表示切り替え
- フォーム送信時の正しいリクエスト生成

### UI機能テスト
- JavaScript機能の動作確認
- フォームバリデーションの動作
- レスポンシブデザインの確認

### セキュリティテスト
- XSS攻撃の防止確認
- 機密情報の適切なマスク表示
- 不正な入力値の適切な処理

## 実装ファイル構成

```
src/setup/index.ts         # GET /setup エンドポイントハンドラー
src/templates/setup.tsx    # HTMLテンプレート
public/styles/setup.css      # CSSスタイルシート
public/scripts/setup.js      # JavaScript機能
test/setup.spec.ts      # テストファイル
src/api/v1/setup/
├── get.ts              # メインハンドラー (既存)
├── post.ts             # セットアップ処理ハンドラー
```
