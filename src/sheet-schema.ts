export interface SheetColumn {
  name: string;
  type: 'string' | 'number' | 'datetime' | 'boolean' | 'array' | 'object' | 'json';
  required?: boolean;
  unique?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  default?: any;
}

export interface SheetSchema {
  name: string;
  columns: SheetColumn[];
}

// Base schema definitions based on SHEET_BASE_SCHEMA.md
export const BASE_SCHEMAS: SheetSchema[] = [
  {
    name: '_User',
    columns: [
      { name: 'id', type: 'string', required: true, unique: true },
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: true, unique: true, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
      { name: 'given_name', type: 'string' },
      { name: 'family_name', type: 'string' },
      { name: 'nickname', type: 'string' },
      { name: 'picture', type: 'string' },
      { name: 'email_verified', type: 'boolean' },
      { name: 'locale', type: 'string' },
      { name: 'created_at', type: 'datetime', required: true },
      { name: 'updated_at', type: 'datetime', required: true },
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
      { name: 'id', type: 'string', required: true, unique: true },
      { name: 'user_id', type: 'string', required: true },
      { name: 'token', type: 'string', required: true },
      { name: 'expires_at', type: 'datetime', required: true },
      { name: 'created_at', type: 'datetime', required: true },
      { name: 'updated_at', type: 'datetime', required: true }
    ]
  },
  {
    name: '_Config',
    columns: [
      { name: 'id', type: 'string', required: true, unique: true },
      { name: 'name', type: 'string', required: true, unique: true },
      { name: 'value', type: 'string', required: true },
      { name: 'created_at', type: 'datetime', required: true },
      { name: 'updated_at', type: 'datetime', required: true },
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
      { name: 'name', type: 'string', required: true, unique: true },
      { name: 'users', type: 'array' },
      { name: 'roles', type: 'array' },
      { name: 'created_at', type: 'datetime', required: true },
      { name: 'updated_at', type: 'datetime', required: true },
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
      // Get existing sheets
      const existingSheets = await this.getExistingSheets();
      
      for (let i = 0; i < BASE_SCHEMAS.length; i++) {
        const schema = BASE_SCHEMAS[i];
        console.log(`Processing schema ${i + 1}/${BASE_SCHEMAS.length}:`, schema.name);
        
        const progress: SetupProgress = {
          currentSheet: schema.name,
          currentStep: 'Checking sheet...',
          completedSheets: [...completedSheets],
          totalSheets,
          progress: Math.round((i / totalSheets) * 100),
          status: 'running'
        };
        
        if (progressCallback) {
          progressCallback(progress);
        }
        
        try {
          // Check if sheet exists
          const existingSheet = existingSheets.find(sheet => sheet.properties?.title === schema.name);
          console.log('Existing sheet found:', !!existingSheet);
          
          if (!existingSheet) {
            // Create sheet
            progress.currentStep = 'Creating sheet...';
            if (progressCallback) progressCallback(progress);
            
            await this.createSheet(schema.name);
          }
          
          // Check and setup header rows
          progress.currentStep = 'Checking header rows...';
          if (progressCallback) progressCallback(progress);
          
          await this.setupSheetHeaders(schema);
          
          // Freeze header rows (up to row 2)
          progress.currentStep = 'Freezing header rows...';
          if (progressCallback) progressCallback(progress);
          
          await this.freezeHeaderRows(schema.name, 2);
          
          // Style header rows
          progress.currentStep = 'Styling header rows...';
          if (progressCallback) progressCallback(progress);
          
          await this.styleHeaderRows(schema);
          
          // Add initial data for _Config sheet
          if (schema.name === '_Config') {
            progress.currentStep = 'Adding initial configuration...';
            if (progressCallback) progressCallback(progress);
            
            await this.addInitialConfigData();
          }
          
          completedSheets.push(schema.name);
          console.log('Schema processed successfully:', schema.name);
          
          // Update intermediate progress
          const intermediateProgress: SetupProgress = {
            currentSheet: schema.name,
            currentStep: 'Completed',
            completedSheets: [...completedSheets],
            totalSheets,
            progress: Math.round((completedSheets.length / totalSheets) * 100),
            status: 'running'
          };
          
          if (progressCallback) {
            progressCallback(intermediateProgress);
          }
          
          // Add short wait time (rate limiting prevention)
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (schemaError) {
          console.error('Error processing schema:', schema.name, schemaError);
          throw new Error(`Failed to process schema ${schema.name}: ${schemaError instanceof Error ? schemaError.message : 'Unknown error'}`);
        }
      }
      
      const finalProgress: SetupProgress = {
        currentSheet: '',
        currentStep: 'Completed',
        completedSheets,
        totalSheets,
        progress: 100,
        status: 'completed'
      };
      
      console.log('Sending final completion progress:', finalProgress);
      if (progressCallback) {
        progressCallback(finalProgress);
        // Short wait to ensure final completion state is saved
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log('Setup process completed successfully');
      return finalProgress;
      
    } catch (error) {
      const errorProgress: SetupProgress = {
        currentSheet: '',
        currentStep: 'An error occurred',
        completedSheets,
        totalSheets,
        progress: Math.round((completedSheets.length / totalSheets) * 100),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
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
  
  private formatColumnSchema(column: SheetColumn): string {
    // Return as string for simple types only
    if (!column.required && !column.unique && !column.pattern && 
        column.minLength === undefined && column.maxLength === undefined &&
        column.min === undefined && column.max === undefined && 
        column.default === undefined) {
      return column.type;
    }
    
    // Return as JSON format when metadata exists
    const schemaObj: any = { type: column.type };
    if (column.required) schemaObj.required = true;
    if (column.unique) schemaObj.unique = true;
    if (column.pattern) schemaObj.pattern = column.pattern;
    if (column.minLength !== undefined) schemaObj.minLength = column.minLength;
    if (column.maxLength !== undefined) schemaObj.maxLength = column.maxLength;
    if (column.min !== undefined) schemaObj.min = column.min;
    if (column.max !== undefined) schemaObj.max = column.max;
    if (column.default !== undefined) schemaObj.default = column.default;
    
    return JSON.stringify(schemaObj);
  }

  private async setupSheetHeaders(schema: SheetSchema): Promise<void> {
    console.log('Setting up headers for sheet:', schema.name);
    
    // Prepare header row (1st row) data
    const headers = schema.columns.map(col => col.name);
    
    // Prepare type row (2nd row) data - JSON format schema definitions
    const types = schema.columns.map(col => this.formatColumnSchema(col));
    
    console.log('Headers:', headers);
    console.log('Types:', types);
    
    try {
      // Check existing data
      console.log('Getting existing sheet data for:', schema.name);
      const existingData = await this.getSheetData(schema.name, 'A1:Z2');
      console.log('Existing data:', existingData);
      
      const updates: any[] = [];
      
      // Check and update header row
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
      
      // Check and update type row
      if (!existingData || !existingData.values || !existingData.values[1] || 
          !this.schemaRowsEqual(existingData.values[1], types)) {
        console.log('Types need update');
        updates.push({
          range: `${schema.name}!A2:${this.getColumnLetter(types.length)}2`,
          values: [types]
        });
      } else {
        console.log('Types are up to date');
      }
      
      // Execute only when update is needed
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
      return null; // Sheet does not exist
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

  private deepEquals(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (a === null || b === null) return false;
    if (a === undefined || b === undefined) return false;
    
    if (typeof a !== 'object' || typeof b !== 'object') {
      return false;
    }
    
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, index) => this.deepEquals(val, b[index]));
    }
    
    if (Array.isArray(a) || Array.isArray(b)) {
      return false;
    }
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      return this.deepEquals(a[key], b[key]);
    });
  }
  
  private isValidJSON(str: string): boolean {
    if (typeof str !== 'string') return false;
    if (!str.trim()) return false;
    
    const trimmed = str.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
    
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  private safeJSONParse(str: string): any | null {
    if (!this.isValidJSON(str)) return null;
    
    try {
      const parsed = JSON.parse(str);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private schemaRowsEqual(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => {
      const aVal = val || '';
      const bVal = b[index] || '';
      
      // Both are the same string
      if (aVal === bVal) return true;
      
      // JSON format comparison
      const aIsJSON = typeof aVal === 'string' && aVal.trim().startsWith('{');
      const bIsJSON = typeof bVal === 'string' && bVal.trim().startsWith('{');
      
      if (aIsJSON || bIsJSON) {
        const aParsed = aIsJSON ? this.safeJSONParse(aVal) : null;
        const bParsed = bIsJSON ? this.safeJSONParse(bVal) : null;
        
        if (aParsed && bParsed) {
          return this.deepEquals(aParsed, bParsed);
        }
        
        // One is JSON, one is string
        if ((aParsed && !bParsed) || (!aParsed && bParsed)) {
          const aObj = aParsed || { type: aVal };
          const bObj = bParsed || { type: bVal };
          
          // Consider equivalent for simple type definitions
          if (Object.keys(aObj).length === 1 && Object.keys(bObj).length === 1 &&
              aObj.type === bObj.type) {
            return true;
          }
        }
      }
      
      return false;
    });
  }
  
  private async freezeHeaderRows(sheetName: string, frozenRowCount: number): Promise<void> {
    console.log(`Freezing header rows for sheet: ${sheetName}, rows: ${frozenRowCount}`);
    
    try {
      // First, get sheet ID
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
      // Treat header freeze errors as warnings and continue setup
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
              // 1st row (column names) styling
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
              // 2nd row (data types) styling
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
      // Treat styling errors as warnings and continue setup
      console.warn('Continuing setup despite header styling error');
    }
  }
  
  private async addInitialConfigData(): Promise<void> {
    console.log('Adding initial configuration data to _Config sheet');
    
    try {
      // Check if data already exists
      const existingData = await this.getSheetData('_Config', 'A3:K8');
      if (existingData?.values && existingData.values.length > 0) {
        console.log('Configuration data already exists, skipping initialization');
        return;
      }
      
      // Prepare initial configuration values
      const configData = [
        ['CREATE_SHEET_BY_API', 'CREATE_SHEET_BY_API', 'false', new Date().toISOString(), new Date().toISOString(), 'false', 'false', '[]', '[]', '[]', '[]'],
        ['CREATE_SHEET_USER', 'CREATE_SHEET_USER', '[]', new Date().toISOString(), new Date().toISOString(), 'false', 'false', '[]', '[]', '[]', '[]'],
        ['CREATE_SHEET_ROLE', 'CREATE_SHEET_ROLE', '[]', new Date().toISOString(), new Date().toISOString(), 'false', 'false', '[]', '[]', '[]', '[]'],
        ['MODIFY_COLUMNS_BY_API', 'MODIFY_COLUMNS_BY_API', 'false', new Date().toISOString(), new Date().toISOString(), 'false', 'false', '[]', '[]', '[]', '[]'],
        ['MODIFY_SHEET_USER', 'MODIFY_SHEET_USER', '[]', new Date().toISOString(), new Date().toISOString(), 'false', 'false', '[]', '[]', '[]', '[]'],
        ['MODIFY_SHEET_ROLE', 'MODIFY_SHEET_ROLE', '[]', new Date().toISOString(), new Date().toISOString(), 'false', 'false', '[]', '[]', '[]', '[]']
      ];
      
      // Update sheet with initial configuration
      await this.updateSheetData([{
        range: '_Config!A3:K8',
        values: configData
      }]);
      
      console.log('Initial configuration data added successfully');
      
    } catch (error) {
      console.error('Error adding initial configuration data:', error);
      // Continue setup even if initial data fails
      console.warn('Continuing setup despite initial data error');
    }
  }
}