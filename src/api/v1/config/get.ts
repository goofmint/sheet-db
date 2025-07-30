import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { html } from 'hono/html';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import { Env } from '@/types/env';

const app = new Hono<{ Bindings: Env }>();

// 機密データのキー
const sensitiveKeys = [
  'google.client_secret',
  'auth0.client_secret',
  'app.config_password'
];

app.get('/', async (c) => {
  try {
    // 認証確認
    const authCookie = getCookie(c, 'config_auth');
    const isAuthenticated = authCookie === 'authenticated';

    // ConfigServiceを初期化
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }

    if (!isAuthenticated) {
      // 未認証時：パスワード入力フォーム
      return c.html(html`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="utf-8">
          <title>設定管理 - SheetDB</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 400px;
              margin: 100px auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .auth-form {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              text-align: center;
            }
            h1 {
              color: #495057;
              margin-bottom: 20px;
            }
            input {
              width: 100%;
              padding: 10px;
              margin: 10px 0;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              font-size: 16px;
            }
            button {
              width: 100%;
              padding: 12px;
              background-color: #007bff;
              color: white;
              border: none;
              border-radius: 4px;
              font-size: 16px;
              cursor: pointer;
            }
            button:hover {
              background-color: #0056b3;
            }
            .error {
              color: #dc3545;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="auth-form">
            <h1>⚙️ 設定管理</h1>
            <p>設定画面にアクセスするにはパスワードが必要です。</p>
            <form method="post" action="/config/auth">
              <input type="password" name="password" placeholder="設定パスワード" required>
              <button type="submit">ログイン</button>
            </form>
            <div class="error" id="error" style="display: none;"></div>
          </div>
        </body>
        </html>
      `);
    }

    // 認証済み時：設定一覧表示
    const configs = ConfigService.getAll();
    
    // 設定データの準備（機密データのマスキング）
    const configList = Object.entries(configs).map(([key, value]) => {
      const isSensitive = sensitiveKeys.includes(key);
      const displayValue = isSensitive ? '****' : String(value);
      const type = ConfigService.getType(key);
      
      return {
        key,
        value: displayValue,
        originalValue: value,
        type,
        isSensitive,
        description: getConfigDescription(key)
      };
    });

    return c.html(html`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="utf-8">
        <title>設定管理 - SheetDB</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          h1 {
            margin: 0;
            color: #495057;
          }
          .logout-btn {
            float: right;
            padding: 8px 16px;
            background-color: #6c757d;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-size: 14px;
          }
          .logout-btn:hover {
            background-color: #5a6268;
          }
          .config-table {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            background-color: #f8f9fa;
            padding: 15px;
            text-align: left;
            font-weight: bold;
            color: #495057;
            border-bottom: 1px solid #dee2e6;
          }
          td {
            padding: 15px;
            border-bottom: 1px solid #dee2e6;
          }
          tr:last-child td {
            border-bottom: none;
          }
          .key-column {
            font-family: monospace;
            font-weight: bold;
            color: #495057;
            width: 25%;
          }
          .value-column {
            width: 40%;
          }
          .value-column input {
            width: 100%;
            padding: 8px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            font-family: monospace;
          }
          .value-column input[type="password"] {
            font-family: Arial, sans-serif;
          }
          .value-column input[type="checkbox"] {
            width: auto;
            transform: scale(1.2);
          }
          .description-column {
            color: #6c757d;
            font-size: 14px;
            width: 35%;
          }
          .sensitive-note {
            color: #dc3545;
            font-size: 12px;
            margin-top: 4px;
          }
          .back-link {
            display: inline-block;
            margin-bottom: 20px;
            padding: 8px 16px;
            background-color: #28a745;
            color: white;
            text-decoration: none;
            border-radius: 4px;
          }
          .back-link:hover {
            background-color: #218838;
          }
        </style>
      </head>
      <body>
        <a href="/playground" class="back-link">← プレイグラウンドに戻る</a>
        
        <div class="header">
          <a href="/config/logout" class="logout-btn">ログアウト</a>
          <h1>⚙️ 設定管理</h1>
          <p>アプリケーションの設定項目を確認できます。設定の変更は次のタスクで実装予定です。</p>
        </div>

        <div class="config-table">
          <table>
            <thead>
              <tr>
                <th>設定キー</th>
                <th>値</th>
                <th>説明</th>
              </tr>
            </thead>
            <tbody>
              ${configList.map((config) => html`
                <tr>
                  <td class="key-column">${config.key}</td>
                  <td class="value-column">
                    ${config.type === 'boolean' ? html`
                      <input type="checkbox" ${config.originalValue ? 'checked' : ''} disabled>
                    ` : html`
                      <input 
                        type="${config.isSensitive ? 'password' : 'text'}" 
                        value="${config.value}" 
                        readonly 
                        title="設定の変更は次のタスクで実装予定です"
                      >
                    `}
                    ${config.isSensitive ? html`
                      <div class="sensitive-note">機密情報（マスキング表示）</div>
                    ` : ''}
                  </td>
                  <td class="description-column">${config.description}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Config page error:', error);
    return c.html(html`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="utf-8">
        <title>エラー - 設定管理</title>
      </head>
      <body>
        <h1>エラーが発生しました</h1>
        <p>設定の読み込み中にエラーが発生しました。</p>
        <a href="/playground">プレイグラウンドに戻る</a>
      </body>
      </html>
    `, 500);
  }
});

// 設定項目の説明を取得する関数
function getConfigDescription(key: string): string {
  const descriptions: Record<string, string> = {
    'google.client_id': 'Google OAuth2 クライアントID',
    'google.client_secret': 'Google OAuth2 クライアントシークレット',
    'google.sheetId': 'メインのGoogle SpreadsheetのID',
    'auth0.domain': 'Auth0ドメイン',
    'auth0.client_id': 'Auth0 アプリケーションのクライアントID',
    'auth0.client_secret': 'Auth0 アプリケーションのクライアントシークレット',
    'auth0.audience': 'Auth0 APIオーディエンス（オプション）',
    'auth0.scope': 'OAuth2スコープ',
    'app.config_password': '設定画面へのアクセスパスワード',
    'app.setup_completed': '初期セットアップ完了フラグ',
    'storage.type': 'ファイルストレージタイプ (r2 | google_drive)'
  };
  
  return descriptions[key] || '設定項目';
}

export default app;