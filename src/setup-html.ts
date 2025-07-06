export const setupHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sheet DB セットアップ</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .section h2 {
            color: #555;
            margin-top: 0;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #333;
        }
        input[type="text"], input[type="url"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
        }
        .google-sheets-btn {
            background-color: #4285f4;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            margin-right: 10px;
        }
        .google-sheets-btn:hover {
            background-color: #3367d6;
        }
        .save-btn {
            background-color: #34a853;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            width: 100%;
        }
        .save-btn:hover {
            background-color: #2d8f47;
        }
        .info {
            background-color: #e8f0fe;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .selected-sheet {
            background-color: #e8f5e8;
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
        }
        .success-info {
            background-color: #e8f5e8;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border-left: 4px solid #34a853;
        }
        .readonly-field {
            background-color: #f8f9fa;
            border: 1px solid #e1e1e1;
        }
        .hidden {
            display: none;
        }
        .reset-btn {
            background-color: #ea4335;
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            margin-left: 10px;
        }
        .reset-btn:hover {
            background-color: #d33b2c;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Sheet DB セットアップ</h1>
        
        <div class="section">
            <h2>1. Google Cloud Console セットアップ</h2>
            <div class="info">
                <p>まず、Google Cloud Consoleで必要なAPIとOAuth設定を行います。</p>
            </div>
            
            <h3>📋 Google Cloud Setup 手順</h3>
            <ol style="margin-left: 20px; line-height: 1.6;">
                <li><a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a> にアクセス</li>
                <li>新しいプロジェクトを作成または既存プロジェクトを選択</li>
                <li><strong>有効にする必要があるAPI:</strong>
                    <ul style="margin: 10px 0;">
                        <li>✅ Google Sheets API</li>
                        <li>✅ Google Drive API</li>
                    </ul>
                </li>
                <li><strong>認証情報の作成:</strong>
                    <ul style="margin: 10px 0;">
                        <li>「認証情報」→「認証情報を作成」→「OAuth 2.0 クライアントID」</li>
                        <li>アプリケーションの種類: <strong>ウェブアプリケーション</strong></li>
                        <li>承認済みリダイレクトURI: <code>https://your-domain.com/auth/callback</code></li>
                    </ul>
                </li>
            </ol>
            
            <h3>🔧 認証情報設定</h3>
            
            <div id="credentials-success" class="success-info hidden">
                <p><strong>✅ 認証情報が設定済みです</strong></p>
                <p>Google OAuth認証情報は既にデータベースに保存されています。</p>
            </div>
            
            <div id="credentials-form">
                <div class="form-group">
                    <label for="google-client-id">Google OAuth Client ID:</label>
                    <input type="text" id="google-client-id" placeholder="あなたのGoogle OAuth Client ID">
                    <button type="button" id="reset-client-id" class="reset-btn hidden">変更</button>
                </div>
                
                <div class="form-group">
                    <label for="google-client-secret">Google OAuth Client Secret:</label>
                    <input type="text" id="google-client-secret" placeholder="あなたのGoogle OAuth Client Secret">
                    <button type="button" id="reset-client-secret" class="reset-btn hidden">変更</button>
                </div>
                
                <div class="info">
                    <p><strong>💡 重要:</strong> 上記の認証情報は入力後にデータベースに保存されます。環境変数の設定は不要です。</p>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>2. Googleスプレッドシート接続</h2>
            
            <div id="auth-success" class="success-info hidden">
                <p><strong>✅ Google認証が完了しています</strong></p>
                <p>Googleアカウントとの接続が既に完了しており、スプレッドシートにアクセス可能です。</p>
            </div>
            
            <div id="connection-section">
                <div class="info">
                    <p>Google Cloudの設定が完了したら、スプレッドシートに接続します。</p>
                </div>
                
                <button class="google-sheets-btn" onclick="connectToGoogle()">
                    🔗 Googleアカウントに接続
                </button>
            </div>
            
            <div id="spreadsheet-selection-section" class="hidden">
                <div class="info">
                    <p>Google認証が完了しました。使用するスプレッドシートを選択してください。</p>
                </div>
                
                <a href="/setup/connect" class="google-sheets-btn" style="display: inline-block; text-decoration: none;">
                    📊 スプレッドシートを選択
                </a>
            </div>
            
            <div id="selected-sheet" class="selected-sheet" style="display: none;">
                <p><strong>✅ 選択済みスプレッドシート:</strong></p>
                <p id="sheet-name"></p>
                <p><strong>URL:</strong> <a id="sheet-url" href="#" target="_blank"></a></p>
                <a href="/setup/connect" style="color: #1a73e8; text-decoration: none; font-size: 14px;">
                    📝 スプレッドシートを変更
                </a>
            </div>
        </div>
        
        <div class="section">
            <h2>3. シート初期化</h2>
            
            <div id="sheets-not-ready" class="info">
                <p>スプレッドシートを選択した後、基本シートの初期化を行います。</p>
                <p>以下のシートが作成・設定されます：</p>
                <ul style="margin: 10px 0 10px 20px;">
                    <li><code>_User</code> - ユーザー情報管理</li>
                    <li><code>_Session</code> - セッション管理</li>
                    <li><code>_Config</code> - 設定情報管理</li>
                    <li><code>_Role</code> - ロール管理</li>
                </ul>
            </div>
            
            <div id="sheets-ready" class="success-info hidden">
                <p><strong>✅ シート初期化が完了しています</strong></p>
                <p>すべての基本シートが正常に設定されています。</p>
            </div>
            
            <div id="sheets-setup-section" class="hidden">
                <button id="setup-sheets-btn" class="google-sheets-btn" onclick="setupSheets()">
                    🔧 シートを初期化
                </button>
                
                <div id="setup-progress" class="hidden" style="margin-top: 20px;">
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #1a73e8;">
                        <h4 style="margin: 0 0 10px 0;">📋 シート初期化中...</h4>
                        <div id="progress-bar-container" style="background-color: #e1e1e1; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0;">
                            <div id="progress-bar" style="background-color: #1a73e8; height: 100%; width: 0%; transition: width 0.3s;"></div>
                        </div>
                        <div id="progress-text" style="font-size: 14px; color: #666;">初期化を開始しています...</div>
                        <div id="progress-details" style="font-size: 12px; color: #999; margin-top: 5px;">
                            完了: <span id="completed-sheets">0</span> / <span id="total-sheets">4</span> シート
                        </div>
                    </div>
                </div>
                
                <div id="setup-error" class="hidden" style="margin-top: 20px;">
                    <div style="background-color: #f8d7da; color: #721c24; padding: 15px; border-radius: 4px; border-left: 4px solid #dc3545;">
                        <h4 style="margin: 0 0 10px 0;">❌ エラーが発生しました</h4>
                        <div id="error-message"></div>
                        <div style="margin-top: 10px;">
                            <button onclick="setupSheets()" style="background-color: #dc3545; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                                🔄 再試行
                            </button>
                            <button onclick="resetSheetSetup()" style="background-color: #6c757d; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                                🔧 リセット
                            </button>
                            <button onclick="markSheetsComplete()" style="background-color: #28a745; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">
                                ✅ 完了としてマーク
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>4. Auth0 認証設定</h2>
            
            <div id="auth0-success" class="success-info hidden">
                <p><strong>✅ Auth0設定が完了しています</strong></p>
                <p>Auth0認証情報は既にデータベースに保存されています。</p>
            </div>
            
            <div id="auth0-form">
                <div class="info">
                    <p>Auth0アカウントの認証情報を設定してください。</p>
                </div>
                
                <div class="form-group">
                    <label for="auth0-domain">Auth0 ドメイン:</label>
                    <input type="text" id="auth0-domain" placeholder="your-tenant.auth0.com">
                    <button type="button" id="reset-auth0-domain" class="reset-btn hidden">変更</button>
                </div>
                
                <div class="form-group">
                    <label for="auth0-client-id">Client ID:</label>
                    <input type="text" id="auth0-client-id" placeholder="あなたのAuth0 Client ID">
                    <button type="button" id="reset-auth0-client-id" class="reset-btn hidden">変更</button>
                </div>
                
                <div class="form-group">
                    <label for="auth0-client-secret">Client Secret:</label>
                    <input type="text" id="auth0-client-secret" placeholder="あなたのAuth0 Client Secret">
                    <button type="button" id="reset-auth0-client-secret" class="reset-btn hidden">変更</button>
                </div>
                
                <div class="form-group">
                    <label for="auth0-audience">Audience (オプション):</label>
                    <input type="text" id="auth0-audience" placeholder="API識別子">
                    <button type="button" id="reset-auth0-audience" class="reset-btn hidden">変更</button>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>5. 🔒 セキュリティ設定</h2>
            <div class="info">
                <p>セットアップをリセットする際に必要なトークンを設定してください。</p>
                <p><strong>⚠️ 重要:</strong> このトークンは安全な場所に保管してください。紛失すると設定をリセットできなくなります。</p>
            </div>
            
            <div class="form-group">
                <label for="reset-token">リセットトークン:</label>
                <input type="text" id="reset-token" placeholder="セキュリティの高いトークンを入力してください">
                <button type="button" id="generate-token-btn" class="reset-btn" style="background-color: #1a73e8; margin-left: 10px;">
                    🎲 ランダム生成
                </button>
            </div>
            
            <div class="info" style="background-color: #fff3cd; border-left: 4px solid #ffc107;">
                <p><strong>💡 推奨:</strong> 32文字以上の英数字と記号を組み合わせたトークンを使用してください。</p>
                <p>例: <code>A7k9$mP2@vX8#qR5!nL3&jH6*wE4</code></p>
            </div>
        </div>
        
        <div class="section">
            <h2>6. 🔐 Auth0認証テスト</h2>
            
            <div id="auth0-test-not-ready" class="info">
                <p>Auth0設定とスプレッドシート設定を完了した後、認証をテストできます。</p>
            </div>
            
            <div id="auth0-test-ready" class="success-info hidden">
                <p><strong>✅ 認証テストの準備ができています</strong></p>
                <p>Auth0認証をテストして、ユーザー情報が_Userシートに正しく保存されることを確認できます。</p>
                <div style="margin-top: 15px;">
                    <a href="/api/auth" class="google-sheets-btn" style="text-decoration: none; display: inline-block;">
                        🔐 Auth0認証をテスト
                    </a>
                </div>
            </div>
        </div>
        
        <button class="save-btn" onclick="saveConfiguration()">
            💾 設定を保存
        </button>
    </div>

    <script>
        let selectedSheet = null;
        let googleCredentials = null;
        
        // ページ読み込み時に設定状況を反映
        document.addEventListener('DOMContentLoaded', function() {
            const config = window.setupConfig || {};
            
            // 認証情報が既に設定されている場合
            if (config.hasCredentials) {
                // 成功メッセージを表示
                document.getElementById('credentials-success').classList.remove('hidden');
                
                // フィールドを読み取り専用にし、値をマスク表示
                const clientIdField = document.getElementById('google-client-id');
                const clientSecretField = document.getElementById('google-client-secret');
                
                clientIdField.value = config.clientId ? maskClientId(config.clientId) : '';
                clientIdField.readOnly = true;
                clientIdField.classList.add('readonly-field');
                
                clientSecretField.value = '••••••••••••••••••••••••••••••••';
                clientSecretField.readOnly = true;
                clientSecretField.classList.add('readonly-field');
                
                // 変更ボタンを表示
                document.getElementById('reset-client-id').classList.remove('hidden');
                document.getElementById('reset-client-secret').classList.remove('hidden');
                
                // 認証情報をセット
                googleCredentials = { 
                    clientId: config.clientId, 
                    clientSecret: '[SAVED]' 
                };
            }
            
            // Google認証が完了している場合
            if (config.authCompleted) {
                document.getElementById('auth-success').classList.remove('hidden');
                document.getElementById('connection-section').style.display = 'none';
                
                // スプレッドシートが選択済みの場合
                if (config.hasSpreadsheet) {
                    document.getElementById('selected-sheet').style.display = 'block';
                    document.getElementById('sheet-name').textContent = config.spreadsheetName;
                    const sheetUrlLink = document.getElementById('sheet-url');
                    sheetUrlLink.textContent = config.spreadsheetUrl;
                    sheetUrlLink.href = config.spreadsheetUrl;
                    
                    // シート初期化セクションを表示
                    if (config.sheetsInitialized) {
                        document.getElementById('sheets-ready').classList.remove('hidden');
                        document.getElementById('sheets-not-ready').style.display = 'none';
                    } else {
                        document.getElementById('sheets-setup-section').classList.remove('hidden');
                        document.getElementById('sheets-not-ready').style.display = 'none';
                    }
                } else {
                    // スプレッドシート選択セクションを表示
                    document.getElementById('spreadsheet-selection-section').classList.remove('hidden');
                }
            }
            
            // Auth0設定が既に存在する場合
            if (config.hasAuth0Config) {
                // 成功メッセージを表示
                document.getElementById('auth0-success').classList.remove('hidden');
                
                // Auth0フィールドに既存の値を設定
                document.getElementById('auth0-domain').value = config.auth0Domain;
                document.getElementById('auth0-client-id').value = maskClientId(config.auth0ClientId);
                document.getElementById('auth0-client-secret').value = '••••••••••••••••••••••••••••••••';
                if (config.auth0Audience) {
                    document.getElementById('auth0-audience').value = config.auth0Audience;
                }
                
                // Auth0フィールドを読み取り専用にする
                document.getElementById('auth0-domain').readOnly = true;
                document.getElementById('auth0-domain').classList.add('readonly-field');
                document.getElementById('auth0-client-id').readOnly = true;
                document.getElementById('auth0-client-id').classList.add('readonly-field');
                document.getElementById('auth0-client-secret').readOnly = true;
                document.getElementById('auth0-client-secret').classList.add('readonly-field');
                document.getElementById('auth0-audience').readOnly = true;
                document.getElementById('auth0-audience').classList.add('readonly-field');
                
                // 変更ボタンを表示
                document.getElementById('reset-auth0-domain').classList.remove('hidden');
                document.getElementById('reset-auth0-client-id').classList.remove('hidden');
                document.getElementById('reset-auth0-client-secret').classList.remove('hidden');
                document.getElementById('reset-auth0-audience').classList.remove('hidden');
            }
            
            // リセットトークンが既に設定されている場合
            if (config.resetToken) {
                document.getElementById('reset-token').value = '••••••••••••••••••••••••••••••••';
                document.getElementById('reset-token').readOnly = true;
                document.getElementById('reset-token').classList.add('readonly-field');
            }
            
            // connected=true パラメータがある場合（認証完了後の戻り）
            if (config.connected) {
                // 成功メッセージを追加表示
                showSuccessMessage('🎉 Google認証が正常に完了しました！');
            }
            
            // spreadsheet=selected パラメータがある場合（スプレッドシート選択後の戻り）
            if (config.spreadsheetSelected) {
                // 成功メッセージを追加表示
                showSuccessMessage('📊 スプレッドシートが正常に選択されました！');
            }
        });
        
        // Client IDをマスク表示する関数
        function maskClientId(clientId) {
            if (clientId.length <= 8) return clientId;
            return clientId.substring(0, 4) + '••••••••••••••••••••••' + clientId.substring(clientId.length - 4);
        }
        
        // 成功メッセージを表示する関数
        function showSuccessMessage(message) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'success-info';
            messageDiv.innerHTML = '<p><strong>' + message + '</strong></p>';
            messageDiv.style.position = 'fixed';
            messageDiv.style.top = '20px';
            messageDiv.style.right = '20px';
            messageDiv.style.zIndex = '1000';
            messageDiv.style.maxWidth = '400px';
            
            document.body.appendChild(messageDiv);
            
            // 5秒後に自動削除
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 5000);
        }
        
        // 認証情報をリセットする関数
        function resetCredentials() {
            const clientIdField = document.getElementById('google-client-id');
            const clientSecretField = document.getElementById('google-client-secret');
            
            clientIdField.value = '';
            clientIdField.readOnly = false;
            clientIdField.classList.remove('readonly-field');
            
            clientSecretField.value = '';
            clientSecretField.readOnly = false;
            clientSecretField.classList.remove('readonly-field');
            
            document.getElementById('credentials-success').classList.add('hidden');
            document.getElementById('reset-client-id').classList.add('hidden');
            document.getElementById('reset-client-secret').classList.add('hidden');
            
            googleCredentials = null;
        }
        
        // Auth0設定をリセットする関数
        function resetAuth0Config() {
            // すべてのAuth0フィールドをリセット
            const auth0Fields = [
                'auth0-domain',
                'auth0-client-id', 
                'auth0-client-secret',
                'auth0-audience'
            ];
            
            auth0Fields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                field.value = '';
                field.readOnly = false;
                field.classList.remove('readonly-field');
                
                // 対応するリセットボタンを非表示
                const resetBtn = document.getElementById('reset-' + fieldId);
                if (resetBtn) {
                    resetBtn.classList.add('hidden');
                }
            });
            
            // 成功メッセージを非表示
            document.getElementById('auth0-success').classList.add('hidden');
        }
        
        // トークン生成関数
        function generateSecureToken() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
            let token = '';
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            for (let i = 0; i < 32; i++) {
                token += chars[array[i] % chars.length];
            }
            return token;
        }
        
        // 変更ボタンとトークン生成ボタンのイベントリスナー
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('reset-client-id').addEventListener('click', resetCredentials);
            document.getElementById('reset-client-secret').addEventListener('click', resetCredentials);
            
            // Auth0リセットボタンのイベントリスナー
            document.getElementById('reset-auth0-domain').addEventListener('click', resetAuth0Config);
            document.getElementById('reset-auth0-client-id').addEventListener('click', resetAuth0Config);
            document.getElementById('reset-auth0-client-secret').addEventListener('click', resetAuth0Config);
            document.getElementById('reset-auth0-audience').addEventListener('click', resetAuth0Config);
            
            document.getElementById('generate-token-btn').addEventListener('click', function() {
                const tokenField = document.getElementById('reset-token');
                tokenField.value = generateSecureToken();
            });
        });
        
        function connectToGoogle() {
            let clientId, clientSecret;
            
            // 既存の認証情報がある場合は使用
            if (googleCredentials && googleCredentials.clientId) {
                clientId = googleCredentials.clientId;
                clientSecret = googleCredentials.clientSecret;
            } else {
                // 新規入力の場合
                clientId = document.getElementById('google-client-id').value;
                clientSecret = document.getElementById('google-client-secret').value;
                
                if (!clientId || !clientSecret) {
                    alert('Google OAuth Client IDとClient Secretを入力してください。');
                    return;
                }
                
                // Google認証情報をセット
                googleCredentials = { clientId, clientSecret };
            }
            
            // 再認証の場合は既存のトークンをクリアする警告を表示
            const config = window.setupConfig || {};
            if (config.authCompleted) {
                if (!confirm('既存のGoogle認証情報をリセットして再認証しますか？\\n\\n注意: 現在保存されているアクセストークンは無効になります。')) {
                    return;
                }
            }
            
            // POST /connects にリクエストしてOAuth URLを取得
            fetch('/connects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    clientId: clientId,
                    clientSecret: clientSecret === '[SAVED]' ? undefined : clientSecret
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.authUrl) {
                    // Google OAuth認可画面にリダイレクト
                    window.location.href = data.authUrl;
                } else {
                    alert('認証URLの取得に失敗しました: ' + (data.error || '不明なエラー'));
                }
            })
            .catch(error => {
                alert('エラーが発生しました: ' + error.message);
            });
        }
        
        function selectGoogleSheet() {
            // このメソッドはOAuth完了後に実行される
            // デモ用のダミーデータ
            selectedSheet = {
                id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
                name: 'サンプルスプレッドシート',
                url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
            };
            
            document.getElementById('selected-sheet').style.display = 'block';
            document.getElementById('sheet-name').textContent = selectedSheet.name;
            document.getElementById('sheet-url').textContent = selectedSheet.url;
        }
        
        // シートセットアップ関数
        function setupSheets() {
            var setupButton = document.getElementById('setup-sheets-btn');
            var progressSection = document.getElementById('setup-progress');
            var errorSection = document.getElementById('setup-error');
            
            // UIを初期化
            setupButton.disabled = true;
            setupButton.textContent = '🔧 初期化中...';
            progressSection.classList.remove('hidden');
            errorSection.classList.add('hidden');
            
            // 進行状況をリセット
            updateProgress({
                currentSheet: '',
                currentStep: '初期化を開始しています...',
                completedSheets: [],
                totalSheets: 4,
                progress: 0,
                status: 'running'
            });
            
            // シートセットアップを開始
            fetch('/api/setup/sheets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(function(response) {
                return response.json();
            })
            .then(function(data) {
                if (data.success) {
                    // 進行状況を監視
                    pollProgress(data.setupId);
                } else {
                    throw new Error(data.error || '不明なエラー');
                }
            })
            .catch(function(error) {
                console.error('Error starting sheet setup:', error);
                showSetupError(error.message);
            });
        }
        
        // 進行状況を監視する関数
        function pollProgress(setupId) {
            var pollCount = 0;
            var maxPolls = 300; // 5分間 (300秒)
            
            var pollInterval = setInterval(function() {
                pollCount++;
                console.log('Polling progress, attempt:', pollCount);
                
                if (pollCount >= maxPolls) {
                    clearInterval(pollInterval);
                    showSetupError('セットアップがタイムアウトしました。再試行してください。');
                    return;
                }
                
                fetch('/api/setup/sheets/progress')
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                    }
                    return response.json();
                })
                .then(function(data) {
                    console.log('Progress data received:', data);
                    
                    if (data.progress) {
                        updateProgress(data.progress);
                        
                        if (data.progress.status === 'completed') {
                            clearInterval(pollInterval);
                            onSetupCompleted();
                        } else if (data.progress.status === 'error') {
                            clearInterval(pollInterval);
                            var errorMsg = data.progress.error || '不明なエラーが発生しました';
                            console.error('Setup error:', errorMsg);
                            showSetupError(errorMsg);
                        }
                    } else {
                        console.warn('No progress data in response:', data);
                    }
                })
                .catch(function(error) {
                    console.error('Error polling progress:', error);
                    // ネットワークエラーの場合は続行（一時的な問題の可能性）
                    if (pollCount % 10 === 0) { // 10秒ごとにエラーログ
                        console.warn('Progress polling failed for 10 seconds, but continuing...');
                    }
                });
            }, 1000); // 1秒ごとに確認
        }
        
        // 進行状況を更新する関数
        function updateProgress(progress) {
            var progressBar = document.getElementById('progress-bar');
            var progressText = document.getElementById('progress-text');
            var completedSheets = document.getElementById('completed-sheets');
            var totalSheets = document.getElementById('total-sheets');
            
            progressBar.style.width = progress.progress + '%';
            progressText.textContent = progress.currentStep;
            completedSheets.textContent = progress.completedSheets.length;
            totalSheets.textContent = progress.totalSheets;
            
            if (progress.currentSheet) {
                progressText.textContent = progress.currentSheet + ': ' + progress.currentStep;
            }
        }
        
        // セットアップ完了時の処理
        function onSetupCompleted() {
            var setupButton = document.getElementById('setup-sheets-btn');
            var progressSection = document.getElementById('setup-progress');
            
            setupButton.disabled = false;
            setupButton.textContent = '🔧 シートを初期化';
            progressSection.classList.add('hidden');
            
            // 成功メッセージを表示
            document.getElementById('sheets-ready').classList.remove('hidden');
            document.getElementById('sheets-setup-section').classList.add('hidden');
            
            // 成功メッセージをポップアップ表示
            showSuccessMessage('📊 シート初期化が完了しました！');
            
            // 設定状態を更新
            var config = window.setupConfig || {};
            config.sheetsInitialized = true;
            window.setupConfig = config;
        }
        
        // エラー表示
        function showSetupError(errorMessage) {
            var setupButton = document.getElementById('setup-sheets-btn');
            var progressSection = document.getElementById('setup-progress');
            var errorSection = document.getElementById('setup-error');
            var errorMessageElement = document.getElementById('error-message');
            
            setupButton.disabled = false;
            setupButton.textContent = '🔧 シートを初期化';
            progressSection.classList.add('hidden');
            errorSection.classList.remove('hidden');
            errorMessageElement.textContent = errorMessage;
        }
        
        // シートセットアップリセット関数
        function resetSheetSetup() {
            if (!confirm('シートセットアップの状態をリセットしますか？\\n\\n進行中の処理が停止され、最初からやり直すことができます。')) {
                return;
            }
            
            fetch('/api/setup/sheets/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(function(response) {
                return response.json();
            })
            .then(function(data) {
                if (data.success) {
                    // UIをリセット
                    var setupButton = document.getElementById('setup-sheets-btn');
                    var progressSection = document.getElementById('setup-progress');
                    var errorSection = document.getElementById('setup-error');
                    
                    setupButton.disabled = false;
                    setupButton.textContent = '🔧 シートを初期化';
                    progressSection.classList.add('hidden');
                    errorSection.classList.add('hidden');
                    
                    showSuccessMessage('🔧 セットアップ状態がリセットされました！');
                } else {
                    alert('リセットに失敗しました: ' + data.error);
                }
            })
            .catch(function(error) {
                console.error('Error resetting sheet setup:', error);
                alert('リセット中にエラーが発生しました: ' + error.message);
            });
        }
        
        function saveConfiguration() {
            const config = window.setupConfig || {};
            
            // Google認証が完了しているが、スプレッドシートが選択されていない場合はチェック
            if (config.authCompleted && !config.hasSpreadsheet && !selectedSheet) {
                alert('スプレッドシートを選択してください。「📊 スプレッドシートを選択」ボタンから選択できます。');
                return;
            }
            
            const configData = {};
            
            // Auth0設定の処理（マスクされている場合は既存値を使用）
            const auth0DomainField = document.getElementById('auth0-domain');
            const auth0ClientIdField = document.getElementById('auth0-client-id');
            const auth0ClientSecretField = document.getElementById('auth0-client-secret');
            const auth0AudienceField = document.getElementById('auth0-audience');
            
            // Auth0設定が既存でマスクされていない場合のみ更新
            if (!auth0DomainField.readOnly) {
                configData.auth0Domain = auth0DomainField.value;
                configData.auth0ClientId = auth0ClientIdField.value;
                configData.auth0ClientSecret = auth0ClientSecretField.value;
                
                const audience = auth0AudienceField.value;
                if (audience && audience.trim()) {
                    configData.auth0Audience = audience;
                }
                
                // 必須フィールドのチェック
                if (!configData.auth0Domain || !configData.auth0ClientId || !configData.auth0ClientSecret) {
                    alert('Auth0の必須フィールドをすべて入力してください。');
                    return;
                }
            }
            
            // リセットトークンの処理
            const resetTokenField = document.getElementById('reset-token');
            
            // マスクされた値かどうかをチェック（•が連続している場合はマスクとみなす）
            const isMaskedValue = resetTokenField.value && /^•+$/.test(resetTokenField.value);
            
            // 読み取り専用でない場合のみ新しい値を検証し、設定
            if (!resetTokenField.readOnly) {
                // リセットトークンのチェック
                if (!resetTokenField.value || resetTokenField.value.length < 16) {
                    alert('リセットトークンは16文字以上で設定してください。セキュリティのため、より長いトークンを推奨します。');
                    return;
                }
                
                // マスクされた値でないことを確認
                if (isMaskedValue) {
                    alert('マスクされた値です。新しいトークンを生成するか、有効なトークンを入力してください。');
                    return;
                }
                
                // 有効な新しいトークンの場合のみ送信
                configData.resetToken = resetTokenField.value;
            } else {
                // 読み取り専用の場合、マスクされた値は送信しない
                if (isMaskedValue) {
                    // マスクされた値の場合は何もしない（既存のトークンを維持）
                    console.log('Reset token is masked, not updating');
                } else if (resetTokenField.value && resetTokenField.value.length >= 16) {
                    // 有効な値の場合のみ送信
                    configData.resetToken = resetTokenField.value;
                }
            }
            
            // スプレッドシート情報があれば追加
            if (selectedSheet) {
                configData.spreadsheetId = selectedSheet.id;
                configData.spreadsheetName = selectedSheet.name;
                configData.spreadsheetUrl = selectedSheet.url;
            }
            
            // デバッグ: 送信するデータをコンソールに出力
            console.log('Sending configuration data keys:', Object.keys(configData));
            console.log('Reset token included:', configData.resetToken !== undefined);
            console.log('Reset token length:', configData.resetToken ? configData.resetToken.length : 'undefined');
            console.log('Reset token is masked:', configData.resetToken && /^•+$/.test(configData.resetToken));
            console.log('Reset token field readonly:', resetTokenField.readOnly);
            console.log('Reset token field value is masked:', isMaskedValue);
            
            // 設定をサーバーに送信
            fetch('/api/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(configData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('設定が保存されました！');
                    window.location.href = '/';
                } else {
                    alert('設定の保存に失敗しました: ' + data.error);
                }
            })
            .catch(error => {
                alert('エラーが発生しました: ' + error.message);
            });
        }
        
        // シート初期化を手動で完了としてマークする関数
        function markSheetsComplete() {
            if (!confirm('シートが実際に作成されていることを確認しましたか？\\n\\nこの操作は、実際にシートが存在する場合にのみ実行してください。\\nGoogleスプレッドシートで_User、_Session、_Config、_Roleの4つのシートが正しく作成されていることを確認してから続行してください。')) {
                return;
            }
            
            const button = event.target;
            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = '確認中...';
            
            fetch('/api/setup/sheets/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(function(response) {
                return response.json();
            })
            .then(function(data) {
                if (data.success) {
                    // 手動完了が成功した場合、UI を完了状態に更新
                    onSetupCompleted();
                    showSuccessMessage('✅ シート初期化が手動で完了としてマークされました！');
                } else {
                    throw new Error(data.error || '手動完了に失敗しました');
                }
            })
            .catch(function(error) {
                console.error('Error marking sheets as complete:', error);
                alert('手動完了でエラーが発生しました: ' + error.message);
            })
            .finally(function() {
                button.disabled = false;
                button.textContent = originalText;
            });
        }
    </script>
</body>
</html>`;