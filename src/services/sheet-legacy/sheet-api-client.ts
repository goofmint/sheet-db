import {
  SheetsValuesResponse,
  SheetsMetadataResponse,
  BatchUpdateRequest,
  ValuesUpdateRequest,
  SheetServiceConfig
} from './types';

/**
 * Low-level Google Sheets API client
 * Handles direct API communication and authentication
 */
export class SheetApiClient {
  constructor(private config: SheetServiceConfig) {}

  /**
   * Update configuration
   */
  updateConfig(config: SheetServiceConfig): void {
    this.config = config;
  }

  /**
   * Get authentication headers with automatic token refresh
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const { GoogleOAuthService } = await import('../google-oauth');
    const oauthService = new GoogleOAuthService();
    
    try {
      const validToken = await oauthService.getValidAccessToken();
      return {
        'Authorization': 'Bearer ' + validToken,
        'Content-Type': 'application/json'
      };
    } catch (error) {
      console.error('Failed to get valid access token:', error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch spreadsheet metadata
   */
  async getSpreadsheetMetadata(): Promise<SheetsMetadataResponse> {
    if (!this.config.spreadsheetId) {
      throw new Error('Spreadsheet ID not configured');
    }

    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}`, {
      headers: await this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get spreadsheet metadata: ${response.statusText}`);
    }

    return await response.json() as SheetsMetadataResponse;
  }

  /**
   * Get values from a specific range
   */
  async getValues(sheetName: string, range?: string): Promise<SheetsValuesResponse> {
    if (!this.config.spreadsheetId) {
      throw new Error('Spreadsheet ID not configured');
    }

    const escapedSheetName = this.escapeSheetName(sheetName);
    const fullRange = range ? `${escapedSheetName}!${range}` : escapedSheetName;
    
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${fullRange}`, {
      headers: await this.getAuthHeaders()
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Sheet doesn't exist
        return { values: [] };
      }
      const errorText = await response.text();
      throw new Error(`Failed to get sheet data ${sheetName}: ${errorText}`);
    }

    return await response.json() as SheetsValuesResponse;
  }

  /**
   * Update values in a specific range
   */
  async updateValues(sheetName: string, data: string[][], range?: string): Promise<void> {
    if (!this.config.spreadsheetId) {
      throw new Error('Spreadsheet ID not configured');
    }

    const escapedSheetName = this.escapeSheetName(sheetName);
    const fullRange = range ? `${escapedSheetName}!${range}` : `${escapedSheetName}!A1`;
    
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${fullRange}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({
        values: data
      } as ValuesUpdateRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update sheet ${sheetName}: ${errorText}`);
    }
  }

  /**
   * Append values to a sheet
   */
  async appendValues(sheetName: string, data: string[][]): Promise<void> {
    if (!this.config.spreadsheetId) {
      throw new Error('Spreadsheet ID not configured');
    }

    const escapedSheetName = this.escapeSheetName(sheetName);
    
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${escapedSheetName}:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({
        values: data
      } as ValuesUpdateRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to append to sheet ${sheetName}: ${errorText}`);
    }
  }

  /**
   * Execute batch update requests
   */
  async batchUpdate(requests: BatchUpdateRequest): Promise<void> {
    if (!this.config.spreadsheetId) {
      throw new Error('Spreadsheet ID not configured');
    }

    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(requests)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Batch update failed: ${errorText}`);
    }
  }

  /**
   * Check if a sheet exists by trying to access its first cell
   */
  async checkSheetExists(sheetName: string): Promise<boolean> {
    try {
      const response = await this.getValues(sheetName, 'A1:A1');
      return response.values !== undefined;
    } catch {
      return false;
    }
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
}