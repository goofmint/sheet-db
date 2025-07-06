export const spreadsheetSelectionHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>スプレッドシート選択 - Sheet DB</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 900px;
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
        .search-section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
            background-color: #f8f9fa;
        }
        .search-input {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
            margin-bottom: 10px;
        }
        .filter-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .filter-btn {
            padding: 8px 16px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: white;
            cursor: pointer;
            font-size: 14px;
        }
        .filter-btn.active {
            background-color: #1a73e8;
            color: white;
            border-color: #1a73e8;
        }
        .loading {
            text-align: center;
            padding: 50px;
            color: #666;
        }
        .spreadsheet-list {
            margin-bottom: 30px;
        }
        .spreadsheet-item {
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.2s;
            background-color: white;
        }
        .spreadsheet-item:hover {
            border-color: #1a73e8;
            box-shadow: 0 2px 5px rgba(26, 115, 232, 0.1);
        }
        .spreadsheet-item.selected {
            border-color: #1a73e8;
            background-color: #e8f0fe;
        }
        .spreadsheet-name {
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        .spreadsheet-info {
            font-size: 14px;
            color: #666;
        }
        .spreadsheet-url {
            font-size: 12px;
            color: #999;
            word-break: break-all;
        }
        .no-results {
            text-align: center;
            padding: 50px;
            color: #666;
        }
        .action-buttons {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background-color: white;
            padding: 20px;
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
            border-top: 1px solid #ddd;
            display: flex;
            gap: 10px;
            justify-content: space-between;
            z-index: 1000;
        }
        
        /* コンテンツエリアに下部余白を追加してボタンと重ならないようにする */
        .container {
            margin-bottom: 100px;
        }
        
        /* モバイル対応 */
        @media (max-width: 768px) {
            .action-buttons {
                flex-direction: column;
                gap: 10px;
            }
            
            .container {
                margin-bottom: 140px;
            }
        }
        
        /* スクロール時のボタン表示状態 */
        .action-buttons.floating {
            animation: slideUp 0.3s ease-out;
        }
        
        @keyframes slideUp {
            from {
                transform: translateY(100%);
            }
            to {
                transform: translateY(0);
            }
        }
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            text-align: center;
        }
        .btn-primary {
            background-color: #34a853;
            color: white;
        }
        .btn-primary:hover {
            background-color: #2d8f47;
        }
        .btn-primary:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        
        /* 選択状態の改善 */
        .spreadsheet-item.selected {
            border-color: #1a73e8;
            background-color: #e8f0fe;
            box-shadow: 0 2px 8px rgba(26, 115, 232, 0.3);
            transform: translateY(-1px);
        }
        
        .spreadsheet-item.selected::before {
            content: "✓";
            position: absolute;
            top: 10px;
            right: 15px;
            background-color: #1a73e8;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }
        
        .spreadsheet-item {
            position: relative;
        }
        .btn-secondary {
            background-color: #6c757d;
            color: white;
        }
        .btn-secondary:hover {
            background-color: #5a6268;
        }
        .error-message {
            background-color: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border: 1px solid #f5c6cb;
        }
        .success-message {
            background-color: #d4edda;
            color: #155724;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border: 1px solid #c3e6cb;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Googleスプレッドシート選択</h1>
        
        <div id="error-container"></div>
        <div id="success-container"></div>
        
        <div class="search-section">
            <input type="text" id="search-input" class="search-input" placeholder="スプレッドシート名で検索...">
            <div class="filter-buttons">
                <button class="filter-btn active" data-filter="all">すべて</button>
                <button class="filter-btn" data-filter="owned">自分が所有</button>
                <button class="filter-btn" data-filter="shared">共有されたもの</button>
                <button class="filter-btn" data-filter="recent">最近使用</button>
            </div>
        </div>
        
        <div id="loading" class="loading">
            <p>📋 スプレッドシートを読み込み中...</p>
        </div>
        
        <div id="spreadsheet-list" class="spreadsheet-list" style="display: none;">
            <!-- スプレッドシート一覧がここに表示される -->
        </div>
        
        <div id="no-results" class="no-results" style="display: none;">
            <p>🔍 該当するスプレッドシートが見つかりませんでした</p>
        </div>
        
        <div class="action-buttons">
            <a href="/setup" class="btn btn-secondary">← セットアップに戻る</a>
            <button id="select-button" class="btn btn-primary" disabled onclick="selectSpreadsheet()">
                選択したスプレッドシートを使用
            </button>
        </div>
    </div>

    <script>
        let spreadsheets = [];
        let filteredSpreadsheets = [];
        let selectedSpreadsheet = null;
        let currentFilter = 'all';
        
        // ページ読み込み時に実行
        document.addEventListener('DOMContentLoaded', function() {
            loadSpreadsheets();
            
            // ボタンエリアにアニメーションを追加
            var actionButtons = document.querySelector('.action-buttons');
            setTimeout(function() {
                actionButtons.classList.add('floating');
            }, 500);
            
            // 検索入力のイベントリスナー
            document.getElementById('search-input').addEventListener('input', function() {
                filterSpreadsheets();
            });
            
            // フィルターボタンのイベントリスナー
            document.querySelectorAll('.filter-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    // アクティブなボタンを切り替え
                    document.querySelectorAll('.filter-btn').forEach(function(b) {
                        b.classList.remove('active');
                    });
                    this.classList.add('active');
                    
                    currentFilter = this.getAttribute('data-filter');
                    filterSpreadsheets();
                });
            });
        });
        
        async function loadSpreadsheets() {
            try {
                const response = await fetch('/api/spreadsheets');
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage = errorData.error || 'HTTP ' + response.status + ': ' + response.statusText;
                    
                    if (response.status === 401) {
                        showError('認証が無効です。セットアップページに戻って再認証してください。');
                        setTimeout(() => {
                            window.location.href = '/setup';
                        }, 3000);
                        return;
                    }
                    
                    throw new Error(errorMessage);
                }
                
                const data = await response.json();
                spreadsheets = data.files || [];
                filteredSpreadsheets = [...spreadsheets];
                
                if (spreadsheets.length === 0) {
                    showError('アクセス可能なスプレッドシートが見つかりませんでした。Google Driveでスプレッドシートを作成してください。');
                } else {
                    displaySpreadsheets();
                    document.getElementById('spreadsheet-list').style.display = 'block';
                }
                
                document.getElementById('loading').style.display = 'none';
                
            } catch (error) {
                console.error('Error loading spreadsheets:', error);
                showError('スプレッドシートの読み込みに失敗しました: ' + error.message);
                document.getElementById('loading').style.display = 'none';
            }
        }
        
        function filterSpreadsheets() {
            var searchTerm = document.getElementById('search-input').value.toLowerCase();
            
            filteredSpreadsheets = spreadsheets.filter(function(sheet) {
                // 検索条件でフィルタ
                var matchesSearch = !searchTerm || sheet.name.toLowerCase().includes(searchTerm);
                
                // フィルタータイプでフィルタ
                var matchesFilter = true;
                switch (currentFilter) {
                    case 'owned':
                        matchesFilter = sheet.ownedByMe === true;
                        break;
                    case 'shared':
                        matchesFilter = sheet.ownedByMe === false;
                        break;
                    case 'recent':
                        // 過去30日以内に変更されたもの
                        var thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        matchesFilter = new Date(sheet.modifiedTime) > thirtyDaysAgo;
                        break;
                    default:
                        matchesFilter = true;
                }
                
                return matchesSearch && matchesFilter;
            });
            
            displaySpreadsheets();
        }
        
        function displaySpreadsheets() {
            var container = document.getElementById('spreadsheet-list');
            var noResults = document.getElementById('no-results');
            
            if (filteredSpreadsheets.length === 0) {
                container.style.display = 'none';
                noResults.style.display = 'block';
                return;
            }
            
            container.style.display = 'block';
            noResults.style.display = 'none';
            
            container.innerHTML = filteredSpreadsheets.map(function(sheet) {
                var ownerName = '不明';
                if (sheet.ownedByMe) {
                    ownerName = '自分';
                } else if (sheet.owners && sheet.owners.length > 0 && sheet.owners[0].displayName) {
                    ownerName = sheet.owners[0].displayName;
                }
                
                return '<div class="spreadsheet-item" data-sheet-id="' + sheet.id + '">' +
                    '<div class="spreadsheet-name">' + escapeHtml(sheet.name) + '</div>' +
                    '<div class="spreadsheet-info">' +
                        '最終更新: ' + formatDate(sheet.modifiedTime) + ' | ' +
                        '所有者: ' + escapeHtml(ownerName) +
                    '</div>' +
                    '<div class="spreadsheet-url">' + sheet.webViewLink + '</div>' +
                '</div>';
            }).join('');
            
            // イベントリスナーを追加
            container.querySelectorAll('.spreadsheet-item').forEach(function(item) {
                item.addEventListener('click', function() {
                    selectSheet(this.getAttribute('data-sheet-id'));
                });
            });
        }
        
        function selectSheet(sheetId) {
            // 以前の選択を解除
            document.querySelectorAll('.spreadsheet-item').forEach(function(item) {
                item.classList.remove('selected');
            });
            
            // 新しい選択を設定
            var selectedItem = document.querySelector('[data-sheet-id="' + sheetId + '"]');
            if (selectedItem) {
                selectedItem.classList.add('selected');
            }
            
            selectedSpreadsheet = spreadsheets.find(function(sheet) {
                return sheet.id === sheetId;
            });
            document.getElementById('select-button').disabled = false;
        }
        
        async function selectSpreadsheet() {
            if (!selectedSpreadsheet) {
                showError('スプレッドシートを選択してください');
                return;
            }
            
            try {
                const response = await fetch('/api/spreadsheets/select', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        spreadsheetId: selectedSpreadsheet.id,
                        spreadsheetName: selectedSpreadsheet.name,
                        spreadsheetUrl: selectedSpreadsheet.webViewLink
                    })
                });
                
                if (!response.ok) {
                    throw new Error('スプレッドシートの選択に失敗しました');
                }
                
                const data = await response.json();
                if (data.success) {
                    let message = 'スプレッドシートが選択されました！';
                    if (data.resetSheetStatus) {
                        message += ' 新しいスプレッドシートのため、シート初期化状態がリセットされました。';
                    }
                    message += ' セットアップページに戻ります...';
                    
                    showSuccess(message);
                    setTimeout(() => {
                        window.location.href = '/setup?spreadsheet=selected';
                    }, 2000);
                } else {
                    throw new Error(data.error || '不明なエラー');
                }
                
            } catch (error) {
                console.error('Error selecting spreadsheet:', error);
                showError('スプレッドシートの選択に失敗しました: ' + error.message);
            }
        }
        
        function formatDate(dateString) {
            var date = new Date(dateString);
            return date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        }
        
        function escapeHtml(text) {
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function showError(message) {
            var container = document.getElementById('error-container');
            container.innerHTML = '<div class="error-message">' + escapeHtml(message) + '</div>';
        }
        
        function showSuccess(message) {
            var container = document.getElementById('success-container');
            container.innerHTML = '<div class="success-message">' + escapeHtml(message) + '</div>';
        }
    </script>
</body>
</html>`;