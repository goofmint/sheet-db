import { ConfigService } from './config';
import { logger } from '../utils/logger';

/**
 * Google Sheets API service
 * Handles all Google Sheets operations
 */
export class SheetService {
  private static instance: SheetService;
  private spreadsheetId: string | null = null;
  private accessToken: string | null = null;

  private constructor() {}

  static getInstance(): SheetService {
    if (!SheetService.instance) {
      SheetService.instance = new SheetService();
    }
    return SheetService.instance;
  }

  /**
   * Initialize with current configuration
   */
  async initialize(): Promise<void> {
    this.spreadsheetId = ConfigService.getString('google.sheetId');
    this.accessToken = ConfigService.getString('google.access_token');

    if (!this.spreadsheetId) {
      throw new Error('Google Sheet ID not configured');
    }
    if (!this.accessToken) {
      throw new Error('Google access token not available');
    }
  }

  /**
   * Create a new sheet with initial data, or update existing sheet structure
   */
  async createSheet(title: string, data: string[][]): Promise<void> {
    await this.ensureInitialized();

    // Check if sheet already exists
    const sheetExists = await this.checkSheetExists(title);
    
    if (!sheetExists) {
      // Create new sheet
      const addSheetResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: title,
                gridProperties: {
                  frozenRowCount: 2
                }
              }
            }
          }]
        })
      });

      if (!addSheetResponse.ok) {
        const errorText = await addSheetResponse.text();
        throw new Error(`Failed to create sheet ${title}: ${errorText}`);
      }

      // Add initial data if provided
      if (data.length > 0) {
        await this.updateSheetData(title, data);
        
        // Freeze header rows (first 2 rows: header + schema)
        try {
          await this.freezeHeaderRows(title, 2);
        } catch (error) {
          logger.warn(`Failed to freeze headers for ${title}, continuing anyway`, {
            sheetName: title,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } else {
      // Sheet exists, check and update structure if needed
      if (data.length > 0) {
        await this.ensureSheetStructure(title, data);
      }
    }
  }

  /**
   * Check if a sheet exists
   */
  private async checkSheetExists(sheetName: string): Promise<boolean> {
    try {
      const escapedSheetName = this.escapeSheetName(sheetName);
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}!A1:A1`, {
        headers: {
          'Authorization': 'Bearer ' + this.accessToken
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Ensure sheet has the correct structure (headers and schema)
   */
  private async ensureSheetStructure(sheetName: string, expectedData: string[][]): Promise<void> {
    if (expectedData.length < 2) return; // Need at least headers and schema

    const expectedHeaders = expectedData[0];
    const expectedSchema = expectedData[1];

    // Get current sheet data
    const escapedSheetName = this.escapeSheetName(sheetName);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}!1:2`, {
      headers: {
        'Authorization': 'Bearer ' + this.accessToken
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get sheet structure for ${sheetName}`);
    }

    const data = await response.json();
    const values = data.values || [];
    
    const currentHeaders = values[0] || [];
    const currentSchema = values[1] || [];

    // Find missing columns
    const missingColumns: string[] = [];
    const missingSchemas: string[] = [];
    
    expectedHeaders.forEach((header, index) => {
      if (!currentHeaders.includes(header)) {
        missingColumns.push(header);
        missingSchemas.push(expectedSchema[index] || 'string');
      }
    });

    if (missingColumns.length > 0) {
      // Add missing columns to the end
      const newHeaders = [...currentHeaders, ...missingColumns];
      const newSchema = [...currentSchema, ...missingSchemas];

      // Update headers and schema
      await this.updateSheetData(sheetName, [newHeaders, newSchema]);
      
      // Ensure header rows are frozen
      try {
        await this.freezeHeaderRows(sheetName, 2);
      } catch (error) {
        logger.warn(`Failed to freeze headers for ${sheetName}, continuing anyway`, {
          sheetName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Update sheet data (replaces all data)
   */
  async updateSheetData(sheetName: string, data: string[][]): Promise<void> {
    await this.ensureInitialized();

    const escapedSheetName = this.escapeSheetName(sheetName);
    
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}!A1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: data
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update sheet ${sheetName}: ${errorText}`);
    }
  }

  /**
   * Get all data from a sheet
   */
  async getSheetData<T>(sheetName: string): Promise<T[]> {
    await this.ensureInitialized();

    const escapedSheetName = this.escapeSheetName(sheetName);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}`, {
      headers: {
        'Authorization': 'Bearer ' + this.accessToken
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Sheet doesn't exist
        return [];
      }
      const errorText = await response.text();
      throw new Error(`Failed to get sheet data ${sheetName}: ${errorText}`);
    }

    const data = await response.json() as { values?: string[][] };
    const values = data.values || [];

    if (values.length < 3) {
      // No data rows (header + schema + data)
      return [];
    }

    const headers = values[0];
    const dataRows = values.slice(2); // Skip header and schema rows

    return dataRows.map((row: string[]) => {
      const record: any = {};
      headers.forEach((header: string, index: number) => {
        const value = row[index] || '';
        
        // Parse value based on type
        if (header.includes('_at') && value) {
          record[header] = value; // Keep as string for now
        } else if (header.includes('public_') && value) {
          record[header] = value.toLowerCase() === 'true';
        } else if (header.endsWith('_read') || header.endsWith('_write')) {
          // Parse array fields
          record[header] = value ? value.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        } else {
          record[header] = value;
        }
      });
      return record as T;
    });
  }

  /**
   * Add a new record to a sheet
   */
  async addRecord<T>(sheetName: string, record: T): Promise<void> {
    await this.ensureInitialized();

    // Get headers to determine the structure
    const headers = await this.getSheetHeaders(sheetName);
    
    // Convert record to row values
    const rowValues = headers.map(header => {
      const value = (record as any)[header];
      if (Array.isArray(value)) {
        return value.join(',');
      } else if (typeof value === 'boolean') {
        return value.toString();
      } else {
        return value?.toString() || '';
      }
    });

    // Append the new row
    const escapedSheetName = this.escapeSheetName(sheetName);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [rowValues]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to add record to ${sheetName}: ${errorText}`);
    }
  }

  /**
   * Update a record by ID
   */
  async updateRecord<T>(sheetName: string, id: string, record: T): Promise<void> {
    await this.ensureInitialized();

    // Get all data to find the row index
    const escapedSheetName = this.escapeSheetName(sheetName);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}`, {
      headers: {
        'Authorization': 'Bearer ' + this.accessToken
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get sheet data for update: ${response.statusText}`);
    }

    const data = await response.json() as { values?: string[][] };
    const values = data.values || [];
    
    if (values.length < 3) {
      throw new Error(`Sheet ${sheetName} has no data rows`);
    }

    const headers = values[0];
    const idColumnIndex = headers.indexOf('id');
    
    if (idColumnIndex === -1) {
      throw new Error(`Sheet ${sheetName} has no 'id' column`);
    }

    // Find the row index (skip header and schema rows)
    let rowIndex = -1;
    for (let i = 2; i < values.length; i++) {
      if (values[i][idColumnIndex] === id) {
        rowIndex = i + 1; // Google Sheets uses 1-based indexing
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error(`Record with ID ${id} not found in ${sheetName}`);
    }

    // Convert record to row values
    const rowValues = headers.map((header: string) => {
      const value = (record as any)[header];
      if (Array.isArray(value)) {
        return value.join(',');
      } else if (typeof value === 'boolean') {
        return value.toString();
      } else {
        return value?.toString() || '';
      }
    });

    // Update the specific row
    const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}!A${rowIndex}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [rowValues]
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update record in ${sheetName}: ${errorText}`);
    }
  }

  /**
   * Delete a record by ID
   */
  async deleteRecord(sheetName: string, id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const deleteLogger = logger.child({
      operation: 'deleteRecord',
      sheetName,
      recordId: id
    });
    
    deleteLogger.debug('Starting record deletion');

    // Get all data to find the row index
    const escapedSheetName = this.escapeSheetName(sheetName);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}`, {
      headers: {
        'Authorization': 'Bearer ' + this.accessToken
      }
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json() as { values?: string[][] };
    const values = data.values || [];
    
    if (values.length < 3) {
      return false;
    }

    const headers = values[0];
    const idColumnIndex = headers.indexOf('id');
    
    if (idColumnIndex === -1) {
      return false;
    }

    // Find the row index
    let rowIndex = -1;
    for (let i = 2; i < values.length; i++) {
      if (values[i][idColumnIndex] === id) {
        rowIndex = i; // 0-based for batchUpdate
        break;
      }
    }

    if (rowIndex === -1) {
      deleteLogger.warn('Record not found for deletion');
      return false;
    }

    // Get the actual sheet ID for the target sheet
    const sheetId = await this.getSheetId(sheetName);
    deleteLogger.debug('Retrieved sheet ID for deletion', { sheetId, rowIndex });
    
    // Delete the row using batchUpdate
    const deleteResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1
            }
          }
        }]
      })
    });

    if (deleteResponse.ok) {
      deleteLogger.info('Successfully deleted record');
      return true;
    } else {
      const errorText = await deleteResponse.text();
      deleteLogger.error('Failed to delete record', undefined, {
        status: deleteResponse.status,
        error: errorText
      });
      return false;
    }
  }

  /**
   * Get sheet headers
   */
  private async getSheetHeaders(sheetName: string): Promise<string[]> {
    const escapedSheetName = this.escapeSheetName(sheetName);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}!1:1`, {
      headers: {
        'Authorization': 'Bearer ' + this.accessToken
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get headers for ${sheetName}`);
    }

    const data = await response.json() as { values?: string[][] };
    return data.values?.[0] || [];
  }

  /**
   * Freeze header rows in a sheet
   */
  private async freezeHeaderRows(sheetName: string, rowCount: number): Promise<void> {
    const sheetLogger = logger.child({ 
      operation: 'freezeHeaderRows', 
      sheetName, 
      rowCount 
    });
    
    try {
      sheetLogger.debug('Attempting to freeze header rows');
      
      // Get sheet ID first
      const sheetId = await this.getSheetId(sheetName);
      sheetLogger.debug('Retrieved sheet ID', { sheetId });
      
      const requestBody = {
        requests: [{
          updateSheetProperties: {
            properties: {
              sheetId: sheetId,
              gridProperties: {
                frozenRowCount: rowCount
              }
            },
            fields: 'gridProperties.frozenRowCount'
          }
        }]
      };
      
      sheetLogger.debug('Prepared freeze request');
      
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        sheetLogger.error('Failed to freeze header rows', undefined, {
          status: response.status,
          error: errorText
        });
        throw new Error(`Failed to freeze header rows: ${errorText}`);
      } else {
        sheetLogger.info('Successfully froze header rows');
      }
    } catch (error) {
      sheetLogger.error('Error freezing header rows', error instanceof Error ? error : new Error(String(error)));
      throw error; // Re-throw instead of just warning
    }
  }

  /**
   * Get sheet ID by name
   */
  private async getSheetId(sheetName: string): Promise<number> {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}`, {
      headers: {
        'Authorization': 'Bearer ' + this.accessToken
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get spreadsheet metadata`);
    }

    const data = await response.json() as { sheets: Array<{ properties: { sheetId: number; title: string } }> };
    const sheet = data.sheets.find(s => s.properties.title === sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet ${sheetName} not found`);
    }
    
    return sheet.properties.sheetId;
  }

  /**
   * Escape sheet name for Google Sheets API according to A1-notation rules
   * 
   * Per Google Sheets A1-notation:
   * - Sheet names containing only letters, numbers, and underscores don't need escaping
   * - All other sheet names must be wrapped in single quotes
   * - Single quotes within the name must be doubled (escaped as '')
   */
  private escapeSheetName(sheetName: string): string {
    // Check if the sheet name contains only safe characters (letters, numbers, underscores)
    const safeCharactersOnly = /^[a-zA-Z0-9_]+$/.test(sheetName);
    
    if (safeCharactersOnly) {
      // No escaping needed for names with only letters, numbers, and underscores
      return sheetName;
    }
    
    // Escape internal single quotes by doubling them
    const escapedName = sheetName.replace(/'/g, "''");
    
    // Wrap the entire name in single quotes
    return `'${escapedName}'`;
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.spreadsheetId || !this.accessToken) {
      await this.initialize();
    }
  }
}