export const playgroundHTML = `<!DOCTYPE html>
<html lang="en">
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
            Authentication Status: Not Authenticated
        </div>

        <!-- Authentication Section -->
        <div class="section auth-section">
            <h2>🔐 Authentication</h2>
            <p><strong>Steps:</strong> 1) Click "Start Authentication" → 2) Login with Auth0 → 3) Copy the displayed session token → 4) Paste it in the field below</p>
            <div class="row">
                <div class="col">
                    <div class="form-group">
                        <label for="sessionToken">Session Token:</label>
                        <input type="text" id="sessionToken" placeholder="Bearer token here...">
                    </div>
                    <button onclick="startAuth()">Start Authentication</button>
                    <a href="/api/auth" target="_blank" style="display: inline-block; background: #17a2b8; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; margin-right: 10px; margin-bottom: 10px;">Start Authentication (Link)</a>
                    <button onclick="checkUserInfo()">Get User Info</button>
                    <button onclick="clearAuth()" class="danger">Clear Authentication</button>
                </div>
            </div>
            <div id="authResult" class="result" style="display: none;"></div>
        </div>

        <!-- Roles Section -->
        <div class="section roles-section">
            <h2>👥 Role Management</h2>
            
            <h3>Create Role</h3>
            <div class="row">
                <div class="col">
                    <div class="form-group">
                        <label for="newRoleName">Role Name:</label>
                        <input type="text" id="newRoleName" placeholder="e.g., editor">
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
            <button onclick="createRole()" class="success">Create Role</button>

            <h3>Update Role</h3>
            <div class="inline-form">
                <div class="form-group">
                    <label for="updateRoleName">Role Name to Update:</label>
                    <input type="text" id="updateRoleName" placeholder="e.g., editor">
                </div>
                <div class="form-group">
                    <label for="updateRoleNewName">New Role Name (optional):</label>
                    <input type="text" id="updateRoleNewName" placeholder="e.g., super_editor">
                </div>
                <button onclick="updateRole()">Update Role</button>
            </div>
            
            <div class="array-input">
                <label>Permission Settings (Enter in JSON array format):</label>
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

            <h3>Delete Role</h3>
            <div class="inline-form">
                <div class="form-group">
                    <label for="deleteRoleName">Role Name to Delete:</label>
                    <input type="text" id="deleteRoleName" placeholder="e.g., old_role">
                </div>
                <button onclick="deleteRole()" class="danger">Delete Role</button>
            </div>

            <div id="rolesResult" class="result" style="display: none;"></div>
        </div>

        <!-- Sheets Section -->
        <div class="section sheets-section">
            <h2>📊 Sheet Management</h2>
            
            <h3>Create Sheet</h3>
            <div class="row">
                <div class="col">
                    <div class="form-group">
                        <label for="newSheetName">Sheet Name:</label>
                        <input type="text" id="newSheetName" placeholder="e.g., UserData">
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
                <label>Permission Settings (Enter in JSON array format):</label>
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
            <button onclick="createSheet()" class="success">Create Sheet</button>

            <h3>Update Sheet</h3>
            <div class="row">
                <div class="col">
                    <div class="form-group">
                        <label for="updateSheetId">Sheet ID:</label>
                        <input type="text" id="updateSheetId" placeholder="e.g., 12345">
                    </div>
                    <div class="form-group">
                        <label for="updateSheetName">New Sheet Name (optional):</label>
                        <input type="text" id="updateSheetName" placeholder="e.g., UpdatedUserData">
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
                <label>Permission Settings (Enter in JSON array format, no changes if empty):</label>
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
            <button onclick="updateSheet()">Update Sheet</button>

            <div id="sheetsResult" class="result" style="display: none;"></div>
        </div>

        <!-- Column Management Section -->
        <div class="section sheets-section">
            <h2>📋 Column Management</h2>
            
            <h3>Get Column Information</h3>
            <p><strong>Note:</strong> Authentication not required. Only sheet read permissions are checked.</p>
            <div class="row">
                <div class="col">
                    <div class="form-group">
                        <label for="getColumnSheetId">Sheet ID:</label>
                        <input type="text" id="getColumnSheetId" placeholder="e.g., 12345">
                    </div>
                </div>
                <div class="col">
                    <div class="form-group">
                        <label for="getColumnName">Column Name:</label>
                        <input type="text" id="getColumnName" placeholder="e.g., user_name">
                    </div>
                </div>
            </div>
            <button onclick="getColumnInfo()">Get Column Info</button>

            <h3>Update Column</h3>
            <p><strong>Note:</strong> Column type changes are not allowed. System columns (id, created_at, updated_at, etc.) cannot be modified.</p>
            <div class="row">
                <div class="col">
                    <div class="form-group">
                        <label for="updateColumnSheetId">Sheet ID:</label>
                        <input type="text" id="updateColumnSheetId" placeholder="e.g., 12345">
                    </div>
                    <div class="form-group">
                        <label for="updateColumnCurrentName">Current Column Name:</label>
                        <input type="text" id="updateColumnCurrentName" placeholder="e.g., user_name">
                    </div>
                    <div class="form-group">
                        <label for="updateColumnNewName">New Column Name (optional):</label>
                        <input type="text" id="updateColumnNewName" placeholder="e.g., username">
                    </div>
                </div>
                <div class="col">
                    <div class="form-group">
                        <label for="updateColumnPattern">Pattern (optional):</label>
                        <input type="text" id="updateColumnPattern" placeholder="e.g., ^[a-zA-Z0-9_]+$">
                    </div>
                    <div class="form-group">
                        <label for="updateColumnMinLength">Min Length (optional):</label>
                        <input type="text" id="updateColumnMinLength" placeholder="e.g., 3">
                    </div>
                    <div class="form-group">
                        <label for="updateColumnMaxLength">Max Length (optional):</label>
                        <input type="text" id="updateColumnMaxLength" placeholder="e.g., 50">
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col">
                    <div class="form-group">
                        <label for="updateColumnMin">Min Value (optional):</label>
                        <input type="text" id="updateColumnMin" placeholder="e.g., 0">
                    </div>
                    <div class="form-group">
                        <label for="updateColumnMax">Max Value (optional):</label>
                        <input type="text" id="updateColumnMax" placeholder="e.g., 100">
                    </div>
                </div>
                <div class="col">
                    <div class="form-group">
                        <label for="updateColumnDefault">Default Value (optional):</label>
                        <input type="text" id="updateColumnDefault" placeholder="e.g., default_value">
                    </div>
                </div>
            </div>
            <button onclick="updateColumn()">Update Column</button>

            <div id="columnsResult" class="result" style="display: none;"></div>
        </div>

        <!-- Data Management Section -->
        <div class="section sheets-section">
            <h2>📊 Data Management</h2>
            
            <h3>Get Sheet Data</h3>
            <p><strong>Note:</strong> Authentication not required for public sheets (public_read=true). Supports advanced query features.</p>
            <div class="row">
                <div class="col">
                    <div class="form-group">
                        <label for="getDataSheetId">Sheet ID:</label>
                        <input type="text" id="getDataSheetId" placeholder="e.g., 12345">
                    </div>
                    <div class="form-group">
                        <label for="getDataQuery">Text Search (optional):</label>
                        <input type="text" id="getDataQuery" placeholder="Search text across all fields">
                    </div>
                    <div class="form-group">
                        <label for="getDataOrder">Sort Order (optional):</label>
                        <input type="text" id="getDataOrder" placeholder="e.g., name, score:desc, category,score:desc">
                    </div>
                </div>
                <div class="col">
                    <div class="form-group">
                        <label for="getDataLimit">Limit Results (optional):</label>
                        <input type="number" id="getDataLimit" placeholder="e.g., 10" min="1" max="1000">
                    </div>
                    <div class="form-group">
                        <label for="getDataPage">Page Number (optional):</label>
                        <input type="number" id="getDataPage" placeholder="e.g., 1" min="1">
                    </div>
                    <div class="checkbox-group">
                        <label>
                            <input type="checkbox" id="getDataCount">
                            Include Count
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="array-input">
                <label>WHERE Conditions (optional, JSON format):</label>
                <div class="form-group">
                    <label for="getDataWhere">WHERE JSON:</label>
                    <textarea id="getDataWhere" placeholder='{
  "score": {"$gte": 1000, "$lte": 3000},
  "category": {"$in": ["A", "B"]},
  "status": {"$ne": "inactive"},
  "email": {"$exists": true},
  "name": {"$regex": "^John"},
  "description": {"$text": "search term"}
}' style="height: 150px;"></textarea>
                </div>
                <p><small>💡 対応演算子: $lt, $lte, $gt, $gte, $ne, $in, $nin, $exists, $regex, $text</small></p>
                <p><small>💡 完全一致: {"field": "value"}. 演算子: {"field": {"$operator": "value"}}</small></p>
            </div>
            <button onclick="getSheetData()">Get Data</button>

            <div id="dataResult" class="result" style="display: none;"></div>

            <h3>Create Sheet Data</h3>
            <p><strong>Note:</strong> Authentication is optional - unauthenticated users can only create data in sheets with public_write=true. Fields id, created_at, and updated_at are automatically generated.</p>
            <div class="form-group">
                <label for="createDataSheetId">Sheet ID:</label>
                <input type="text" id="createDataSheetId" placeholder="e.g., 12345">
            </div>
            <div class="array-input">
                <label>Data to Create (JSON format):</label>
                <div class="form-group">
                    <label for="createDataBody">Data JSON:</label>
                    <textarea id="createDataBody" placeholder='{
  "name": "John Doe",
  "email": "john@example.com",
  "score": 1500,
  "category": "A",
  "is_active": true,
  "metadata": {
    "location": "Tokyo",
    "department": "Engineering"
  },
  "tags": ["developer", "senior"]
}' style="height: 200px;"></textarea>
                </div>
                <p><small>💡 Do not include id, created_at, or updated_at - they will be generated automatically</small></p>
                <p><small>💡 All fields must match existing columns in the sheet</small></p>
                <p><small>💡 Data will be validated against the sheet schema</small></p>
            </div>
            <button onclick="createSheetData()">Create Data</button>

            <div id="createDataResult" class="result" style="display: none;"></div>
        </div>
    </div>

    <script>
        // Constants
        const SESSION_TOKEN_KEY = 'sheet-db-session-token';

        // Helper functions
        function getAuthHeaders() {
            const token = document.getElementById('sessionToken').value.trim();
            if (!token) {
                throw new Error('Session token is not set');
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
                statusElement.textContent = 'Authentication Status: Authenticated';
            } else {
                statusElement.className = 'status unauthenticated';
                statusElement.textContent = 'Authentication Status: Not Authenticated';
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
                showResult('authResult', { message: 'Authentication page opened. After completing authentication, copy and paste the session token.' });
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
            showResult('authResult', { message: 'Authentication information cleared' });
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
                    throw new Error('Role name is required');
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
                    throw new Error('Role name to update is required');
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
                    throw new Error('Please specify at least one item to update');
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
                    throw new Error('Role name to delete is required');
                }

                if (!confirm(\`Delete role "\${roleName}"?\`)) {
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
                    throw new Error('Sheet name is required');
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
                    throw new Error('Sheet ID is required');
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
                    throw new Error('Please specify at least one item to update');
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

        // Column functions
        async function getColumnInfo() {
            try {
                const sheetId = document.getElementById('getColumnSheetId').value.trim();
                const columnName = document.getElementById('getColumnName').value.trim();
                
                if (!sheetId) {
                    throw new Error('Sheet ID is required');
                }
                
                if (!columnName) {
                    throw new Error('Column name is required');
                }

                // Note: This endpoint doesn't require authentication, but can use it if available
                const token = document.getElementById('sessionToken').value.trim();
                const headers = { 'Content-Type': 'application/json' };
                if (token) {
                    headers['Authorization'] = token.startsWith('Bearer ') ? token : \`Bearer \${token}\`;
                }

                const response = await fetch(\`/api/sheets/\${encodeURIComponent(sheetId)}/columns/\${encodeURIComponent(columnName)}\`, {
                    method: 'GET',
                    headers
                });
                const data = await response.json();
                
                showResult('columnsResult', data, !data.success);
                
                // Clear form on success
                if (data.success) {
                    document.getElementById('getColumnSheetId').value = '';
                    document.getElementById('getColumnName').value = '';
                }
            } catch (error) {
                showResult('columnsResult', { error: error.message }, true);
            }
        }

        async function updateColumn() {
            try {
                const headers = getAuthHeaders();
                const sheetId = document.getElementById('updateColumnSheetId').value.trim();
                const currentName = document.getElementById('updateColumnCurrentName').value.trim();
                
                if (!sheetId) {
                    throw new Error('Sheet ID is required');
                }
                
                if (!currentName) {
                    throw new Error('Current column name is required');
                }

                const body = {};
                
                const newName = document.getElementById('updateColumnNewName').value.trim();
                if (newName) body.name = newName;
                
                const pattern = document.getElementById('updateColumnPattern').value.trim();
                if (pattern) body.pattern = pattern;
                
                const minLength = document.getElementById('updateColumnMinLength').value.trim();
                if (minLength) body.minLength = parseInt(minLength);
                
                const maxLength = document.getElementById('updateColumnMaxLength').value.trim();
                if (maxLength) body.maxLength = parseInt(maxLength);
                
                const min = document.getElementById('updateColumnMin').value.trim();
                if (min) body.min = parseFloat(min);
                
                const max = document.getElementById('updateColumnMax').value.trim();
                if (max) body.max = parseFloat(max);
                
                const defaultValue = document.getElementById('updateColumnDefault').value.trim();
                if (defaultValue) {
                    // Try to parse as number, boolean, or keep as string
                    let parsedDefault = defaultValue;
                    if (defaultValue === 'true') parsedDefault = true;
                    else if (defaultValue === 'false') parsedDefault = false;
                    else if (defaultValue === 'null') parsedDefault = null;
                    else if (!isNaN(defaultValue) && defaultValue !== '') parsedDefault = parseFloat(defaultValue);
                    
                    body.default = parsedDefault;
                }

                if (Object.keys(body).length === 0) {
                    throw new Error('Please specify at least one item to update');
                }

                const response = await fetch(\`/api/sheets/\${encodeURIComponent(sheetId)}/columns/\${encodeURIComponent(currentName)}\`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body)
                });
                const data = await response.json();
                
                showResult('columnsResult', data, !data.success);
                
                // Clear form on success
                if (data.success) {
                    document.getElementById('updateColumnSheetId').value = '';
                    document.getElementById('updateColumnCurrentName').value = '';
                    document.getElementById('updateColumnNewName').value = '';
                    document.getElementById('updateColumnPattern').value = '';
                    document.getElementById('updateColumnMinLength').value = '';
                    document.getElementById('updateColumnMaxLength').value = '';
                    document.getElementById('updateColumnMin').value = '';
                    document.getElementById('updateColumnMax').value = '';
                    document.getElementById('updateColumnDefault').value = '';
                }
            } catch (error) {
                showResult('columnsResult', { error: error.message }, true);
            }
        }

        // Data functions  
        async function getSheetData() {
            try {
                const sheetId = document.getElementById('getDataSheetId').value.trim();
                if (!sheetId) {
                    throw new Error('Sheet ID is required');
                }
                
                // Build query parameters
                const params = new URLSearchParams();
                
                const query = document.getElementById('getDataQuery').value.trim();
                if (query) params.append('query', query);
                
                const where = document.getElementById('getDataWhere').value.trim();
                if (where) {
                    try {
                        JSON.parse(where); // Validate JSON
                        params.append('where', encodeURIComponent(where));
                    } catch (e) {
                        throw new Error('Invalid WHERE JSON format');
                    }
                }
                
                const limit = document.getElementById('getDataLimit').value.trim();
                if (limit) params.append('limit', limit);
                
                const page = document.getElementById('getDataPage').value.trim();
                if (page) params.append('page', page);
                
                const order = document.getElementById('getDataOrder').value.trim();
                if (order) params.append('order', order);
                
                const count = document.getElementById('getDataCount').checked;
                if (count) params.append('count', 'true');
                
                // Build URL
                const url = \`/api/sheets/\${encodeURIComponent(sheetId)}/data\${params.toString() ? '?' + params.toString() : ''}\`;
                
                // Try without authentication first (for public sheets)
                let headers = { 'Content-Type': 'application/json' };
                const token = document.getElementById('sessionToken').value.trim();
                if (token) {
                    headers['Authorization'] = token.startsWith('Bearer ') ? token : \`Bearer \${token}\`;
                }
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: headers
                });
                
                const data = await response.json();
                
                // Enhanced result display for data
                if (data.success) {
                    let displayData = {
                        success: data.success,
                        totalResults: data.results.length
                    };
                    
                    if (data.count !== undefined) {
                        displayData.totalCount = data.count;
                    }
                    
                    displayData.results = data.results;
                    
                    // Add summary information
                    if (data.results.length > 0) {
                        displayData.sampleFields = Object.keys(data.results[0]);
                    }
                    
                    showResult('dataResult', displayData, false);
                } else {
                    showResult('dataResult', data, true);
                }
                
                // Clear form on success
                if (data.success) {
                    document.getElementById('getDataSheetId').value = '';
                    document.getElementById('getDataQuery').value = '';
                    document.getElementById('getDataWhere').value = '';
                    document.getElementById('getDataLimit').value = '';
                    document.getElementById('getDataPage').value = '';
                    document.getElementById('getDataOrder').value = '';
                    document.getElementById('getDataCount').checked = false;
                }
                
            } catch (error) {
                showResult('dataResult', { error: error.message }, true);
            }
        }

        async function createSheetData() {
            try {
                const sheetId = document.getElementById('createDataSheetId').value.trim();
                if (!sheetId) {
                    throw new Error('Sheet ID is required');
                }
                
                const dataBody = document.getElementById('createDataBody').value.trim();
                if (!dataBody) {
                    throw new Error('Data JSON is required');
                }
                
                let data;
                try {
                    data = JSON.parse(dataBody);
                } catch (e) {
                    throw new Error('Invalid JSON format in data body');
                }
                
                // Check for restricted fields
                const restrictedFields = ['id', 'created_at', 'updated_at'];
                for (const field of restrictedFields) {
                    if (data.hasOwnProperty(field)) {
                        throw new Error(\`Field '\${field}' cannot be specified - it will be generated automatically\`);
                    }
                }
                
                // Build URL
                const url = \`/api/sheets/\${encodeURIComponent(sheetId)}/data\`;
                
                // Try without authentication first (for public_write sheets)
                let headers = { 'Content-Type': 'application/json' };
                const token = document.getElementById('sessionToken').value.trim();
                if (token) {
                    headers['Authorization'] = token.startsWith('Bearer ') ? token : \`Bearer \${token}\`;
                }
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                // Enhanced result display for created data
                if (result.success) {
                    let displayData = {
                        success: result.success,
                        message: 'Data created successfully'
                    };
                    
                    if (Object.keys(result.data).length > 0) {
                        displayData.createdData = result.data;
                        displayData.generatedFields = {
                            id: result.data.id,
                            created_at: result.data.created_at,
                            updated_at: result.data.updated_at
                        };
                    } else {
                        displayData.message = 'Data created successfully (no read permission - empty response)';
                    }
                    
                    showResult('createDataResult', displayData, false);
                } else {
                    showResult('createDataResult', result, true);
                }
                
                // Clear form on success
                if (result.success) {
                    document.getElementById('createDataSheetId').value = '';
                    document.getElementById('createDataBody').value = '';
                }
                
            } catch (error) {
                showResult('createDataResult', { error: error.message }, true);
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