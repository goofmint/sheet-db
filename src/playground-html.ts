export const playgroundHTML = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sheet DB Playground</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        .section {
            margin-bottom: 40px;
            padding: 20px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: #fafafa;
        }
        .section h2 {
            margin-top: 0;
            color: #444;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }
        .auth-section {
            background: #e3f2fd;
        }
        .roles-section {
            background: #f3e5f5;
        }
        .sheets-section {
            background: #e8f5e8;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: #555;
        }
        input[type="text"], input[type="email"], textarea, select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
        }
        textarea {
            height: 100px;
            resize: vertical;
        }
        button {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        button:hover {
            background: #0056b3;
        }
        button.danger {
            background: #dc3545;
        }
        button.danger:hover {
            background: #c82333;
        }
        button.success {
            background: #28a745;
        }
        button.success:hover {
            background: #218838;
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
            max-height: 300px;
            overflow-y: auto;
        }
        .result.success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .result.error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .status {
            padding: 10px;
            margin-bottom: 20px;
            border-radius: 4px;
            font-weight: 500;
        }
        .status.authenticated {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .status.unauthenticated {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .row {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
        }
        .col {
            flex: 1;
        }
        .inline-form {
            display: flex;
            gap: 10px;
            align-items: flex-end;
            flex-wrap: wrap;
        }
        .inline-form .form-group {
            margin-bottom: 0;
        }
        .array-input {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #dee2e6;
            margin-bottom: 10px;
        }
        .array-input label {
            font-size: 12px;
            color: #666;
        }
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        .checkbox-group input[type="checkbox"] {
            width: auto;
        }
        #sessionToken {
            font-family: monospace;
            font-size: 12px;
            background: #f8f9fa;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Sheet DB API Playground</h1>
        
        <div class="status" id="authStatus">
            認証状態: 未認証
        </div>

        <!-- Authentication Section -->
        <div class="section auth-section">
            <h2>🔐 認証</h2>
            <p><strong>手順:</strong> 1) 認証開始ボタンをクリック → 2) Auth0でログイン → 3) 表示されたセッショントークンをコピー → 4) 下記フィールドに貼り付け</p>
            <div class="row">
                <div class="col">
                    <div class="form-group">
                        <label for="sessionToken">セッショントークン:</label>
                        <input type="text" id="sessionToken" placeholder="Bearer token here...">
                    </div>
                    <button onclick="startAuth()">認証開始</button>
                    <a href="/api/auth" target="_blank" style="display: inline-block; background: #17a2b8; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; margin-right: 10px; margin-bottom: 10px;">認証開始 (リンク)</a>
                    <button onclick="checkUserInfo()">ユーザー情報取得</button>
                    <button onclick="clearAuth()" class="danger">認証クリア</button>
                </div>
            </div>
            <div id="authResult" class="result" style="display: none;"></div>
        </div>

        <!-- Roles Section -->
        <div class="section roles-section">
            <h2>👥 ロール管理</h2>
            
            <h3>ロール作成</h3>
            <div class="row">
                <div class="col">
                    <div class="form-group">
                        <label for="newRoleName">ロール名:</label>
                        <input type="text" id="newRoleName" placeholder="例: editor">
                    </div>
                </div>
                <div class="col">
                    <div class="checkbox-group">
                        <label>
                            <input type="checkbox" id="newRolePublicRead">
                            public_read
                        </label>
                        <label>
                            <input type="checkbox" id="newRolePublicWrite">
                            public_write
                        </label>
                    </div>
                </div>
            </div>
            <button onclick="createRole()" class="success">ロール作成</button>

            <h3>ロール更新</h3>
            <div class="inline-form">
                <div class="form-group">
                    <label for="updateRoleName">更新するロール名:</label>
                    <input type="text" id="updateRoleName" placeholder="例: editor">
                </div>
                <div class="form-group">
                    <label for="updateRoleNewName">新しいロール名 (optional):</label>
                    <input type="text" id="updateRoleNewName" placeholder="例: super_editor">
                </div>
                <button onclick="updateRole()">ロール更新</button>
            </div>
            
            <div class="array-input">
                <label>権限設定 (JSON配列形式で入力):</label>
                <div class="row">
                    <div class="col">
                        <div class="form-group">
                            <label for="updateRoleRead">role_read:</label>
                            <input type="text" id="updateRoleRead" placeholder='["viewer", "editor"]'>
                        </div>
                        <div class="form-group">
                            <label for="updateRoleWrite">role_write:</label>
                            <input type="text" id="updateRoleWrite" placeholder='["admin"]'>
                        </div>
                    </div>
                    <div class="col">
                        <div class="form-group">
                            <label for="updateUserRead">user_read:</label>
                            <input type="text" id="updateUserRead" placeholder='["user123"]'>
                        </div>
                        <div class="form-group">
                            <label for="updateUserWrite">user_write:</label>
                            <input type="text" id="updateUserWrite" placeholder='["user456"]'>
                        </div>
                    </div>
                </div>
            </div>

            <h3>ロール削除</h3>
            <div class="inline-form">
                <div class="form-group">
                    <label for="deleteRoleName">削除するロール名:</label>
                    <input type="text" id="deleteRoleName" placeholder="例: old_role">
                </div>
                <button onclick="deleteRole()" class="danger">ロール削除</button>
            </div>

            <div id="rolesResult" class="result" style="display: none;"></div>
        </div>

        <!-- Sheets Section -->
        <div class="section sheets-section">
            <h2>📊 シート管理</h2>
            
            <h3>シート作成</h3>
            <div class="row">
                <div class="col">
                    <div class="form-group">
                        <label for="newSheetName">シート名:</label>
                        <input type="text" id="newSheetName" placeholder="例: UserData">
                    </div>
                </div>
                <div class="col">
                    <div class="checkbox-group">
                        <label>
                            <input type="checkbox" id="newSheetPublicRead" checked>
                            public_read
                        </label>
                        <label>
                            <input type="checkbox" id="newSheetPublicWrite">
                            public_write
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="array-input">
                <label>権限設定 (JSON配列形式で入力):</label>
                <div class="row">
                    <div class="col">
                        <div class="form-group">
                            <label for="newSheetRoleRead">role_read:</label>
                            <input type="text" id="newSheetRoleRead" placeholder='[]'>
                        </div>
                        <div class="form-group">
                            <label for="newSheetRoleWrite">role_write:</label>
                            <input type="text" id="newSheetRoleWrite" placeholder='["admin"]'>
                        </div>
                    </div>
                    <div class="col">
                        <div class="form-group">
                            <label for="newSheetUserRead">user_read:</label>
                            <input type="text" id="newSheetUserRead" placeholder='[]'>
                        </div>
                        <div class="form-group">
                            <label for="newSheetUserWrite">user_write:</label>
                            <input type="text" id="newSheetUserWrite" placeholder='[]'>
                        </div>
                    </div>
                </div>
            </div>
            <button onclick="createSheet()" class="success">シート作成</button>

            <h3>シート更新</h3>
            <div class="row">
                <div class="col">
                    <div class="form-group">
                        <label for="updateSheetId">シートID:</label>
                        <input type="text" id="updateSheetId" placeholder="例: 12345">
                    </div>
                    <div class="form-group">
                        <label for="updateSheetName">新しいシート名 (optional):</label>
                        <input type="text" id="updateSheetName" placeholder="例: UpdatedUserData">
                    </div>
                </div>
                <div class="col">
                    <div class="checkbox-group">
                        <label>
                            <input type="checkbox" id="updateSheetPublicRead">
                            public_read
                        </label>
                        <label>
                            <input type="checkbox" id="updateSheetPublicWrite">
                            public_write
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="array-input">
                <label>権限設定 (JSON配列形式で入力、空の場合は変更されません):</label>
                <div class="row">
                    <div class="col">
                        <div class="form-group">
                            <label for="updateSheetRoleRead">role_read:</label>
                            <input type="text" id="updateSheetRoleRead" placeholder='["viewer"]'>
                        </div>
                        <div class="form-group">
                            <label for="updateSheetRoleWrite">role_write:</label>
                            <input type="text" id="updateSheetRoleWrite" placeholder='["editor"]'>
                        </div>
                    </div>
                    <div class="col">
                        <div class="form-group">
                            <label for="updateSheetUserRead">user_read:</label>
                            <input type="text" id="updateSheetUserRead" placeholder='["user123"]'>
                        </div>
                        <div class="form-group">
                            <label for="updateSheetUserWrite">user_write:</label>
                            <input type="text" id="updateSheetUserWrite" placeholder='["user456"]'>
                        </div>
                    </div>
                </div>
            </div>
            <button onclick="updateSheet()">シート更新</button>

            <h3>カラム情報取得</h3>
            <div class="inline-form">
                <div class="form-group">
                    <label for="columnSheetId">シートID/名前:</label>
                    <input type="text" id="columnSheetId" placeholder="例: 12345 or UserData">
                </div>
                <div class="form-group">
                    <label for="columnId">カラム名:</label>
                    <input type="text" id="columnId" placeholder="例: name">
                </div>
                <button onclick="getColumnInfo()">カラム情報取得</button>
            </div>

            <div id="sheetsResult" class="result" style="display: none;"></div>
        </div>
    </div>

    <script>
        // Constants
        const SESSION_TOKEN_KEY = 'sheet-db-session-token';

        // Helper functions
        function getAuthHeaders() {
            const token = document.getElementById('sessionToken').value.trim();
            if (!token) {
                throw new Error('セッショントークンが設定されていません');
            }
            return {
                'Authorization': token.startsWith('Bearer ') ? token : \`Bearer \${token}\`,
                'Content-Type': 'application/json'
            };
        }

        // LocalStorage functions
        function saveTokenToStorage(token) {
            try {
                localStorage.setItem(SESSION_TOKEN_KEY, token);
            } catch (error) {
                console.error('Failed to save token to localStorage:', error);
            }
        }

        function loadTokenFromStorage() {
            try {
                return localStorage.getItem(SESSION_TOKEN_KEY) || '';
            } catch (error) {
                console.error('Failed to load token from localStorage:', error);
                return '';
            }
        }

        function clearTokenFromStorage() {
            try {
                localStorage.removeItem(SESSION_TOKEN_KEY);
            } catch (error) {
                console.error('Failed to clear token from localStorage:', error);
            }
        }

        function showResult(elementId, data, isError = false) {
            const element = document.getElementById(elementId);
            element.className = \`result \${isError ? 'error' : 'success'}\`;
            element.textContent = JSON.stringify(data, null, 2);
            element.style.display = 'block';
        }

        function updateAuthStatus() {
            const token = document.getElementById('sessionToken').value.trim();
            const statusElement = document.getElementById('authStatus');
            if (token) {
                statusElement.className = 'status authenticated';
                statusElement.textContent = '認証状態: 認証済み';
            } else {
                statusElement.className = 'status unauthenticated';
                statusElement.textContent = '認証状態: 未認証';
            }
        }

        function parseJsonArray(value) {
            if (!value || value.trim() === '') return undefined;
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : undefined;
            } catch {
                return undefined;
            }
        }

        // Authentication functions
        function startAuth() {
            try {
                // Redirect directly to the auth endpoint
                window.open('/api/auth', '_blank');
                showResult('authResult', { message: '認証ページを開きました。認証完了後、セッショントークンをコピーして貼り付けてください。' });
            } catch (error) {
                showResult('authResult', { error: error.message }, true);
            }
        }

        async function checkUserInfo() {
            try {
                const headers = getAuthHeaders();
                const response = await fetch('/api/users/me', { headers });
                const data = await response.json();
                
                // Save token to localStorage if user info request succeeds
                if (data.success) {
                    const token = document.getElementById('sessionToken').value.trim();
                    saveTokenToStorage(token);
                }
                
                showResult('authResult', data, !data.success);
                updateAuthStatus();
            } catch (error) {
                showResult('authResult', { error: error.message }, true);
            }
        }

        function clearAuth() {
            document.getElementById('sessionToken').value = '';
            // Clear token from localStorage
            clearTokenFromStorage();
            updateAuthStatus();
            showResult('authResult', { message: '認証情報をクリアしました' });
        }

        // Role functions
        async function createRole() {
            try {
                const headers = getAuthHeaders();
                const body = {
                    name: document.getElementById('newRoleName').value.trim(),
                    public_read: document.getElementById('newRolePublicRead').checked,
                    public_write: document.getElementById('newRolePublicWrite').checked
                };

                if (!body.name) {
                    throw new Error('ロール名は必須です');
                }

                const response = await fetch('/api/roles', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body)
                });
                const data = await response.json();
                
                showResult('rolesResult', data, !data.success);
                
                // Clear form on success
                if (data.success) {
                    document.getElementById('newRoleName').value = '';
                    document.getElementById('newRolePublicRead').checked = false;
                    document.getElementById('newRolePublicWrite').checked = false;
                }
            } catch (error) {
                showResult('rolesResult', { error: error.message }, true);
            }
        }

        async function updateRole() {
            try {
                const headers = getAuthHeaders();
                const roleName = document.getElementById('updateRoleName').value.trim();
                
                if (!roleName) {
                    throw new Error('更新するロール名は必須です');
                }

                const body = {};
                
                const newName = document.getElementById('updateRoleNewName').value.trim();
                if (newName) body.name = newName;
                
                const roleRead = parseJsonArray(document.getElementById('updateRoleRead').value);
                if (roleRead !== undefined) body.role_read = roleRead;
                
                const roleWrite = parseJsonArray(document.getElementById('updateRoleWrite').value);
                if (roleWrite !== undefined) body.role_write = roleWrite;
                
                const userRead = parseJsonArray(document.getElementById('updateUserRead').value);
                if (userRead !== undefined) body.user_read = userRead;
                
                const userWrite = parseJsonArray(document.getElementById('updateUserWrite').value);
                if (userWrite !== undefined) body.user_write = userWrite;

                if (Object.keys(body).length === 0) {
                    throw new Error('更新する項目を少なくとも1つ指定してください');
                }

                const response = await fetch(\`/api/roles/\${encodeURIComponent(roleName)}\`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body)
                });
                const data = await response.json();
                
                showResult('rolesResult', data, !data.success);
            } catch (error) {
                showResult('rolesResult', { error: error.message }, true);
            }
        }

        async function deleteRole() {
            try {
                const headers = getAuthHeaders();
                const roleName = document.getElementById('deleteRoleName').value.trim();
                
                if (!roleName) {
                    throw new Error('削除するロール名は必須です');
                }

                if (!confirm(\`ロール "\${roleName}" を削除しますか？\`)) {
                    return;
                }

                const response = await fetch(\`/api/roles/\${encodeURIComponent(roleName)}\`, {
                    method: 'DELETE',
                    headers
                });
                const data = await response.json();
                
                showResult('rolesResult', data, !data.success);
                
                // Clear form on success
                if (data.success) {
                    document.getElementById('deleteRoleName').value = '';
                }
            } catch (error) {
                showResult('rolesResult', { error: error.message }, true);
            }
        }

        // Sheet functions
        async function createSheet() {
            try {
                const headers = getAuthHeaders();
                const body = {
                    name: document.getElementById('newSheetName').value.trim(),
                    public_read: document.getElementById('newSheetPublicRead').checked,
                    public_write: document.getElementById('newSheetPublicWrite').checked
                };

                if (!body.name) {
                    throw new Error('シート名は必須です');
                }

                const roleRead = parseJsonArray(document.getElementById('newSheetRoleRead').value);
                if (roleRead !== undefined) body.role_read = roleRead;
                
                const roleWrite = parseJsonArray(document.getElementById('newSheetRoleWrite').value);
                if (roleWrite !== undefined) body.role_write = roleWrite;
                
                const userRead = parseJsonArray(document.getElementById('newSheetUserRead').value);
                if (userRead !== undefined) body.user_read = userRead;
                
                const userWrite = parseJsonArray(document.getElementById('newSheetUserWrite').value);
                if (userWrite !== undefined) body.user_write = userWrite;

                const response = await fetch('/api/sheets', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body)
                });
                const data = await response.json();
                
                showResult('sheetsResult', data, !data.success);
                
                // Clear form on success
                if (data.success) {
                    document.getElementById('newSheetName').value = '';
                    document.getElementById('newSheetPublicRead').checked = true;
                    document.getElementById('newSheetPublicWrite').checked = false;
                    document.getElementById('newSheetRoleRead').value = '';
                    document.getElementById('newSheetRoleWrite').value = '';
                    document.getElementById('newSheetUserRead').value = '';
                    document.getElementById('newSheetUserWrite').value = '';
                }
            } catch (error) {
                showResult('sheetsResult', { error: error.message }, true);
            }
        }

        async function updateSheet() {
            try {
                const headers = getAuthHeaders();
                const sheetId = document.getElementById('updateSheetId').value.trim();
                
                if (!sheetId) {
                    throw new Error('シートIDは必須です');
                }

                const body = {};
                
                const newName = document.getElementById('updateSheetName').value.trim();
                if (newName) body.name = newName;
                
                // Note: For checkboxes, we only include them if they're checked
                // This allows users to explicitly set permissions
                if (document.getElementById('updateSheetPublicRead').checked) {
                    body.public_read = true;
                }
                if (document.getElementById('updateSheetPublicWrite').checked) {
                    body.public_write = true;
                }
                
                const roleRead = parseJsonArray(document.getElementById('updateSheetRoleRead').value);
                if (roleRead !== undefined) body.role_read = roleRead;
                
                const roleWrite = parseJsonArray(document.getElementById('updateSheetRoleWrite').value);
                if (roleWrite !== undefined) body.role_write = roleWrite;
                
                const userRead = parseJsonArray(document.getElementById('updateSheetUserRead').value);
                if (userRead !== undefined) body.user_read = userRead;
                
                const userWrite = parseJsonArray(document.getElementById('updateSheetUserWrite').value);
                if (userWrite !== undefined) body.user_write = userWrite;

                if (Object.keys(body).length === 0) {
                    throw new Error('更新する項目を少なくとも1つ指定してください');
                }

                const response = await fetch(\`/api/sheets/\${encodeURIComponent(sheetId)}\`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body)
                });
                const data = await response.json();
                
                showResult('sheetsResult', data, !data.success);
            } catch (error) {
                showResult('sheetsResult', { error: error.message }, true);
            }
        }

        // Column info function
        async function getColumnInfo() {
            try {
                const sheetId = document.getElementById('columnSheetId').value.trim();
                const columnId = document.getElementById('columnId').value.trim();
                
                if (!sheetId) {
                    throw new Error('シートID/名前は必須です');
                }
                
                if (!columnId) {
                    throw new Error('カラム名は必須です');
                }

                const response = await fetch(\`/api/sheets/\${encodeURIComponent(sheetId)}/columns/\${encodeURIComponent(columnId)}\`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const data = await response.json();
                
                showResult('sheetsResult', data, !data.success);
            } catch (error) {
                showResult('sheetsResult', { error: error.message }, true);
            }
        }

        // Initialize
        document.getElementById('sessionToken').addEventListener('input', updateAuthStatus);
        
        // Load token from localStorage on page load
        const savedToken = loadTokenFromStorage();
        if (savedToken) {
            document.getElementById('sessionToken').value = savedToken;
        }
        
        updateAuthStatus();
    </script>
</body>
</html>`;