export interface SheetColumn {
  name: string;
  type: 'string' | 'number' | 'datetime' | 'boolean' | 'array' | 'object';
}

export interface SheetSchema {
  name: string;
  columns: SheetColumn[];
}

// SHEET_BASE_SCHEMA.mdに基づく基本スキーマ定義
export const BASE_SCHEMAS: SheetSchema[] = [
  {
    name: '_User',
    columns: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'given_name', type: 'string' },
      { name: 'family_name', type: 'string' },
      { name: 'nickname', type: 'string' },
      { name: 'picture', type: 'string' },
      { name: 'email_verified', type: 'boolean' },
      { name: 'locale', type: 'string' },
      { name: 'created_at', type: 'datetime' },
      { name: 'updated_at', type: 'datetime' },
      { name: 'public_read', type: 'boolean' },
      { name: 'public_write', type: 'boolean' },
      { name: 'role_read', type: 'array' },
      { name: 'role_write', type: 'array' },
      { name: 'user_read', type: 'array' },
      { name: 'user_write', type: 'array' }
    ]
  },
  {
    name: '_Session',
    columns: [
      { name: 'id', type: 'string' },
      { name: 'user_id', type: 'string' },
      { name: 'token', type: 'string' },
      { name: 'expires_at', type: 'datetime' },
      { name: 'created_at', type: 'datetime' },
      { name: 'updated_at', type: 'datetime' }
    ]
  },
  {
    name: '_Config',
    columns: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'value', type: 'string' },
      { name: 'created_at', type: 'datetime' },
      { name: 'updated_at', type: 'datetime' },
      { name: 'public_read', type: 'boolean' },
      { name: 'public_write', type: 'boolean' },
      { name: 'role_read', type: 'array' },
      { name: 'role_write', type: 'array' },
      { name: 'user_read', type: 'array' },
      { name: 'user_write', type: 'array' }
    ]
  },
  {
    name: '_Role',
    columns: [
      { name: 'name', type: 'string' }, // UNIQUE: ロール名は一意である必要があります
      { name: 'users', type: 'array' },
      { name: 'roles', type: 'array' },
      { name: 'created_at', type: 'datetime' },
      { name: 'updated_at', type: 'datetime' },
      { name: 'public_read', type: 'boolean' },
      { name: 'public_write', type: 'boolean' },
      { name: 'role_read', type: 'array' },
      { name: 'role_write', type: 'array' },
      { name: 'user_read', type: 'array' },
      { name: 'user_write', type: 'array' }
    ]
  }
];

export interface SetupProgress {
  currentSheet: string;
  currentStep: string;
  completedSheets: string[];
  totalSheets: number;
  progress: number; // 0-100
  status: 'running' | 'completed' | 'error';
  error?: string;
}

export interface GoogleSheetsService {
  spreadsheetId: string;
  accessToken: string;
}

export class SheetsSetupManager {
  private service: GoogleSheetsService;
  private baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

  constructor(service: GoogleSheetsService) {
    this.service = service;
  }

  async setupSheets(
    progressCallback?: (progress: SetupProgress) => void
  ): Promise<SetupProgress> {
    const totalSheets = BASE_SCHEMAS.length;
    let completedSheets: string[] = [];
    
    try {
      // 既存のシートを取得
      const existingSheets = await this.getExistingSheets();
      
      for (let i = 0; i < BASE_SCHEMAS.length; i++) {
        const schema = BASE_SCHEMAS[i];
        console.log(`Processing schema ${i + 1}/${BASE_SCHEMAS.length}:`, schema.name);
        
        const progress: SetupProgress = {
          currentSheet: schema.name,
          currentStep: 'シートの確認中...',
          completedSheets: [...completedSheets],
          totalSheets,
          progress: Math.round((i / totalSheets) * 100),
          status: 'running'
        };
        
        if (progressCallback) {
          progressCallback(progress);
        }
        
        try {
          // シートの存在確認
          const existingSheet = existingSheets.find(sheet => sheet.properties?.title === schema.name);
          console.log('Existing sheet found:', !!existingSheet);
          
          if (!existingSheet) {
            // シートを作成
            progress.currentStep = 'シートを作成中...';
            if (progressCallback) progressCallback(progress);
            
            await this.createSheet(schema.name);
          }
          
          // ヘッダー行の確認・設定
          progress.currentStep = 'ヘッダー行を確認中...';
          if (progressCallback) progressCallback(progress);
          
          await this.setupSheetHeaders(schema);
          
          // ヘッダー行を固定（2行目まで）
          progress.currentStep = 'ヘッダー行を固定中...';
          if (progressCallback) progressCallback(progress);
          
          await this.freezeHeaderRows(schema.name, 2);
          
          // ヘッダー行のスタイリング
          progress.currentStep = 'ヘッダー行をスタイリング中...';
          if (progressCallback) progressCallback(progress);
          
          await this.styleHeaderRows(schema);
          
          completedSheets.push(schema.name);
          console.log('Schema processed successfully:', schema.name);
          
          // 中間進行状況を更新
          const intermediateProgress: SetupProgress = {
            currentSheet: schema.name,
            currentStep: '完了',
            completedSheets: [...completedSheets],
            totalSheets,
            progress: Math.round((completedSheets.length / totalSheets) * 100),
            status: 'running'
          };
          
          if (progressCallback) {
            progressCallback(intermediateProgress);
          }
          
          // 短い待機時間を追加（レート制限対策）
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (schemaError) {
          console.error('Error processing schema:', schema.name, schemaError);
          throw new Error(`Failed to process schema ${schema.name}: ${schemaError instanceof Error ? schemaError.message : 'Unknown error'}`);
        }
      }
      
      const finalProgress: SetupProgress = {
        currentSheet: '',
        currentStep: '完了',
        completedSheets,
        totalSheets,
        progress: 100,
        status: 'completed'
      };
      
      console.log('Sending final completion progress:', finalProgress);
      if (progressCallback) {
        progressCallback(finalProgress);
        // 最終的な完了状態を確実に保存するため短い待機
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log('Setup process completed successfully');
      return finalProgress;
      
    } catch (error) {
      const errorProgress: SetupProgress = {
        currentSheet: '',
        currentStep: 'エラーが発生しました',
        completedSheets,
        totalSheets,
        progress: Math.round((completedSheets.length / totalSheets) * 100),
        status: 'error',
        error: error instanceof Error ? error.message : '不明なエラー'
      };
      
      if (progressCallback) {
        progressCallback(errorProgress);
      }
      
      return errorProgress;
    }
  }
  
  private async getExistingSheets(): Promise<any[]> {
    console.log('Getting existing sheets for spreadsheet:', this.service.spreadsheetId);
    
    const response = await fetch(
      `${this.baseUrl}/${this.service.spreadsheetId}?fields=sheets.properties`,
      {
        headers: {
          'Authorization': `Bearer ${this.service.accessToken}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to get spreadsheet info:', response.status, errorText);
      throw new Error(`Failed to get spreadsheet info: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json() as any;
    console.log('Existing sheets:', data.sheets?.map((s: any) => s.properties?.title) || []);
    return data.sheets || [];
  }
  
  private async createSheet(sheetName: string): Promise<void> {
    console.log('Creating sheet:', sheetName);
    
    const response = await fetch(
      `${this.baseUrl}/${this.service.spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.service.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }
          ]
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create sheet:', sheetName, response.status, errorText);
      throw new Error(`Failed to create sheet ${sheetName}: ${response.status} - ${errorText}`);
    }
    
    console.log('Sheet created successfully:', sheetName);
  }
  
  private async setupSheetHeaders(schema: SheetSchema): Promise<void> {
    console.log('Setting up headers for sheet:', schema.name);
    
    // ヘッダー行（1行目）のデータを準備
    const headers = schema.columns.map(col => col.name);
    
    // 型行（2行目）のデータを準備
    const types = schema.columns.map(col => col.type);
    
    console.log('Headers:', headers);
    console.log('Types:', types);
    
    try {
      // 既存のデータを確認
      console.log('Getting existing sheet data for:', schema.name);
      const existingData = await this.getSheetData(schema.name, 'A1:Z2');
      console.log('Existing data:', existingData);
      
      const updates: any[] = [];
      
      // ヘッダー行をチェック・更新
      if (!existingData || !existingData.values || !existingData.values[0] || 
          !this.arraysEqual(existingData.values[0], headers)) {
        console.log('Headers need update');
        updates.push({
          range: `${schema.name}!A1:${this.getColumnLetter(headers.length)}1`,
          values: [headers]
        });
      } else {
        console.log('Headers are up to date');
      }
      
      // 型行をチェック・更新
      if (!existingData || !existingData.values || !existingData.values[1] || 
          !this.arraysEqual(existingData.values[1], types)) {
        console.log('Types need update');
        updates.push({
          range: `${schema.name}!A2:${this.getColumnLetter(types.length)}2`,
          values: [types]
        });
      } else {
        console.log('Types are up to date');
      }
      
      // 更新が必要な場合のみ実行
      if (updates.length > 0) {
        console.log('Updating sheet data:', updates);
        await this.updateSheetData(updates);
        console.log('Sheet data updated successfully');
      } else {
        console.log('No updates needed for sheet:', schema.name);
      }
    } catch (error) {
      console.error('Error setting up headers for sheet:', schema.name, error);
      throw error;
    }
  }
  
  private async getSheetData(sheetName: string, range: string): Promise<any> {
    const url = `${this.baseUrl}/${this.service.spreadsheetId}/values/${encodeURIComponent(sheetName)}!${range}`;
    console.log('Getting sheet data from URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.service.accessToken}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (response.status === 404) {
      console.log('Sheet not found (404):', sheetName);
      return null; // シートが存在しない
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to get sheet data:', response.status, errorText);
      throw new Error(`Failed to get sheet data: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Sheet data retrieved:', data);
    return data;
  }
  
  private async updateSheetData(updates: any[]): Promise<void> {
    console.log('Updating sheet data with:', JSON.stringify(updates, null, 2));
    
    const response = await fetch(
      `${this.baseUrl}/${this.service.spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.service.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: updates
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to update sheet data:', response.status, errorText);
      throw new Error(`Failed to update sheet data: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Sheet data update result:', result);
  }
  
  private getColumnLetter(columnNumber: number): string {
    let column = '';
    while (columnNumber > 0) {
      const remainder = (columnNumber - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      columnNumber = Math.floor((columnNumber - 1) / 26);
    }
    return column;
  }
  
  private arraysEqual(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }
  
  private async freezeHeaderRows(sheetName: string, frozenRowCount: number): Promise<void> {
    console.log(`Freezing header rows for sheet: ${sheetName}, rows: ${frozenRowCount}`);
    
    try {
      // まず、シートIDを取得
      const sheetId = await this.getSheetId(sheetName);
      
      const response = await fetch(
        `${this.baseUrl}/${this.service.spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.service.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId: sheetId,
                    gridProperties: {
                      frozenRowCount: frozenRowCount
                    }
                  },
                  fields: 'gridProperties.frozenRowCount'
                }
              }
            ]
          })
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to freeze header rows:', sheetName, response.status, errorText);
        throw new Error(`Failed to freeze header rows for ${sheetName}: ${response.status} - ${errorText}`);
      }
      
      console.log('Header rows frozen successfully for sheet:', sheetName);
      
    } catch (error) {
      console.error('Error freezing header rows for sheet:', sheetName, error);
      // ヘッダー固定のエラーは警告として扱い、セットアップを継続
      console.warn('Continuing setup despite header freeze error');
    }
  }
  
  private async getSheetId(sheetName: string): Promise<number> {
    console.log('Getting sheet ID for:', sheetName);
    
    const response = await fetch(
      `${this.baseUrl}/${this.service.spreadsheetId}?fields=sheets.properties`,
      {
        headers: {
          'Authorization': `Bearer ${this.service.accessToken}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to get spreadsheet info for sheet ID:', response.status, errorText);
      throw new Error(`Failed to get spreadsheet info: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json() as any;
    const sheet = data.sheets?.find((s: any) => s.properties?.title === sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }
    
    const sheetId = sheet.properties?.sheetId;
    if (sheetId === undefined) {
      throw new Error(`Sheet ID not found for: ${sheetName}`);
    }
    
    console.log(`Sheet ID for ${sheetName}:`, sheetId);
    return sheetId;
  }
  
  private async styleHeaderRows(schema: SheetSchema): Promise<void> {
    console.log('Styling header rows for sheet:', schema.name);
    
    try {
      const sheetId = await this.getSheetId(schema.name);
      const columnCount = schema.columns.length;
      
      const response = await fetch(
        `${this.baseUrl}/${this.service.spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.service.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              // 1行目（カラム名）のスタイリング
              {
                repeatCell: {
                  range: {
                    sheetId: sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: columnCount
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: {
                        red: 0.9,
                        green: 0.9,
                        blue: 1.0
                      },
                      textFormat: {
                        bold: true,
                        fontSize: 11
                      },
                      horizontalAlignment: 'CENTER'
                    }
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                }
              },
              // 2行目（データ型）のスタイリング
              {
                repeatCell: {
                  range: {
                    sheetId: sheetId,
                    startRowIndex: 1,
                    endRowIndex: 2,
                    startColumnIndex: 0,
                    endColumnIndex: columnCount
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: {
                        red: 0.95,
                        green: 0.95,
                        blue: 0.95
                      },
                      textFormat: {
                        italic: true,
                        fontSize: 10
                      },
                      horizontalAlignment: 'CENTER'
                    }
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                }
              }
            ]
          })
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to style header rows:', schema.name, response.status, errorText);
        throw new Error(`Failed to style header rows for ${schema.name}: ${response.status} - ${errorText}`);
      }
      
      console.log('Header rows styled successfully for sheet:', schema.name);
      
    } catch (error) {
      console.error('Error styling header rows for sheet:', schema.name, error);
      // スタイリングのエラーは警告として扱い、セットアップを継続
      console.warn('Continuing setup despite header styling error');
    }
  }
}