interface SheetSelectionProps {
  accessToken: string;
  configPassword: string;
  isSetupCompleted?: boolean;
  isAuthenticated?: boolean;
  error?: string;
}

export default function SheetSelectionTemplate({ accessToken, configPassword, isSetupCompleted, isAuthenticated, error }: SheetSelectionProps) {
  return (
    <html>
      <head>
        <title>Select Google Sheets</title>
        <style>{`
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .selection-container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .success-icon {
            font-size: 48px;
            color: #28a745;
            margin-bottom: 20px;
          }
          .title {
            color: #28a745;
            margin-bottom: 10px;
            font-size: 24px;
          }
          .subtitle {
            color: #6c757d;
            margin-bottom: 30px;
          }
          .sheets-list {
            margin-bottom: 20px;
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 10px;
          }
          .sheet-item {
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .sheet-item:hover {
            background-color: #f8f9fa;
          }
          .sheet-item.selected {
            background-color: #e3f2fd;
            border-color: #2196f3;
          }
          .sheet-name {
            font-weight: bold;
            margin-bottom: 5px;
          }
          .sheet-url {
            color: #6c757d;
            font-size: 12px;
            word-break: break-all;
          }
          .loading {
            text-align: center;
            color: #6c757d;
            padding: 20px;
          }
          .buttons {
            position: sticky;
            bottom: 0;
            background: white;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #dee2e6;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
            margin-top: 20px;
          }
          .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin: 0 10px;
          }
          .btn-primary {
            background-color: #007bff;
            color: white;
          }
          .btn-primary:hover {
            background-color: #0056b3;
          }
          .btn-secondary {
            background-color: #6c757d;
            color: white;
          }
          .btn-secondary:hover {
            background-color: #5a6268;
          }
          .auth-form {
            text-align: center;
            max-width: 400px;
            margin: 0 auto;
          }
          .form-group {
            margin-bottom: 20px;
            text-align: left;
          }
          .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #495057;
          }
          .form-group input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 16px;
          }
          .error-message {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 20px;
          }
        `}</style>
      </head>
      <body>
        <div className="selection-container">
          {isSetupCompleted && !isAuthenticated ? (
            <div>
              <div className="header">
                <div className="success-icon">🔒</div>
                <h1 className="title">Authentication Required</h1>
                <p className="subtitle">Please enter your configuration password to proceed</p>
              </div>
              
              <div className="auth-form">
                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}
                
                <form method="POST">
                  <div className="form-group">
                    <label htmlFor="password">Configuration Password:</label>
                    <input 
                      type="password" 
                      id="password" 
                      name="password" 
                      required 
                      autoFocus
                    />
                  </div>
                  
                  <button type="submit" className="btn btn-primary">
                    Authenticate
                  </button>
                  <button type="button" className="btn btn-secondary" id="cancel-auth-btn">
                    Cancel
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div>
              <div className="header">
                <div className="success-icon">✅</div>
                <h1 className="title">Authentication Successful</h1>
                <p className="subtitle">Please select a Google Sheet to use with SheetDB</p>
              </div>
              
              <div id="sheets-list" className="sheets-list">
                <div className="loading">Loading your Google Sheets...</div>
              </div>
              
              <div className="buttons">
                <button id="select-btn" className="btn btn-primary" disabled>
                  Select Sheet
                </button>
                <button className="btn btn-secondary" id="cancel-success-btn">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {(!isSetupCompleted || isAuthenticated) && (
          <>
            <div id="auth-data" style="display: none;" data-access-token={accessToken} data-config-password={configPassword}></div>
            <script dangerouslySetInnerHTML={{
              __html: `
                let selectedSheetId = null;

              async function loadSheets() {
                try {
                  const authData = document.getElementById('auth-data');
                  const accessToken = authData.dataset.accessToken;
                  
                  const response = await fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent('mimeType="application/vnd.google-apps.spreadsheet"') + '&fields=files(id,name,webViewLink)', {
                    headers: {
                      'Authorization': 'Bearer ' + accessToken
                    }
                  });

                  if (!response.ok) {
                    throw new Error('Failed to fetch sheets');
                  }

                  const data = await response.json();
                  console.log('Google Drive API response:', data);
                  displaySheets(data.files || []);
                } catch (error) {
                  document.getElementById('sheets-list').innerHTML = 
                    '<div class="loading" style="color: #dc3545;">Error loading sheets: ' + error.message + '</div>';
                }
              }

              function displaySheets(sheets) {
                const listElement = document.getElementById('sheets-list');
                
                if (!sheets || sheets.length === 0) {
                  listElement.innerHTML = '<div class="loading">No Google Sheets found. Please create one first.</div>';
                  return;
                }

                // Clear the list
                listElement.innerHTML = '';
                
                // Create sheet items using DOM methods
                sheets.forEach(sheet => {
                  const sheetItem = document.createElement('div');
                  sheetItem.className = 'sheet-item';
                  sheetItem.dataset.sheetId = sheet.id;
                  
                  const sheetName = document.createElement('div');
                  sheetName.className = 'sheet-name';
                  sheetName.textContent = sheet.name;
                  
                  const sheetUrl = document.createElement('div');
                  sheetUrl.className = 'sheet-url';
                  sheetUrl.textContent = sheet.webViewLink;
                  
                  sheetItem.appendChild(sheetName);
                  sheetItem.appendChild(sheetUrl);
                  
                  // Add click event listener
                  sheetItem.addEventListener('click', function() {
                    selectSheet(sheet.id, this);
                  });
                  
                  listElement.appendChild(sheetItem);
                });
              }

              function selectSheet(sheetId, element) {
                // Remove previous selection
                document.querySelectorAll('.sheet-item').forEach(item => {
                  item.classList.remove('selected');
                });
                
                // Add selection to clicked item
                element.classList.add('selected');
                selectedSheetId = sheetId;
                
                // Enable select button
                document.getElementById('select-btn').disabled = false;
              }

              document.getElementById('select-btn').addEventListener('click', async function() {
                if (!selectedSheetId) return;
                
                try {
                  const authData = document.getElementById('auth-data');
                  const configPassword = authData.dataset.configPassword;
                  const accessToken = authData.dataset.accessToken;
                  
                  // Save selected sheet ID to backend with authentication
                  const response = await fetch('/api/v1/setup', {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer ' + configPassword
                    },
                    body: JSON.stringify({ sheetId: selectedSheetId })
                  });

                  if (!response.ok) {
                    throw new Error('Failed to save selected sheet');
                  }

                  // Redirect to sheet initialization page
                  window.location.href = '/sheet/initialize?accessToken=' + encodeURIComponent(accessToken);
                } catch (error) {
                  alert('Error selecting sheet: ' + error.message);
                }
              });

              // Add event listeners for cancel buttons
              const cancelAuthBtn = document.getElementById('cancel-auth-btn');
              if (cancelAuthBtn) {
                cancelAuthBtn.addEventListener('click', function() {
                  window.close();
                });
              }
              
              const cancelSuccessBtn = document.getElementById('cancel-success-btn');
              if (cancelSuccessBtn) {
                cancelSuccessBtn.addEventListener('click', function() {
                  window.close();
                });
              }

              // Load sheets on page load
              loadSheets();
            `
          }} />
          </>
        )}
      </body>
    </html>
  );
}