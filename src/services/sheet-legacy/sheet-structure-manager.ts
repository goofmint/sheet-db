import { SheetApiClient } from './sheet-api-client';
import { logger } from '../../utils/logger';

/**
 * Manages sheet structure including creation, headers, and freezing
 */
export class SheetStructureManager {
  constructor(private apiClient: SheetApiClient) {}

  /**
   * Create a new sheet with initial data, or update existing sheet structure
   */
  async createSheet(title: string, data: string[][]): Promise<void> {
    // Check if sheet already exists
    const sheetExists = await this.apiClient.checkSheetExists(title);
    
    if (!sheetExists) {
      // Create new sheet
      await this.apiClient.batchUpdate({
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
      });

      // Add initial data if provided
      if (data.length > 0) {
        await this.apiClient.updateValues(title, data);
        
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
   * Ensure sheet has the correct structure (headers and schema)
   */
  async ensureSheetStructure(sheetName: string, expectedData: string[][]): Promise<void> {
    if (expectedData.length < 2) return; // Need at least headers and schema

    const expectedHeaders = expectedData[0];
    const expectedSchema = expectedData[1];

    // Get current sheet structure (first 2 rows)
    const response = await this.apiClient.getValues(sheetName, '1:2');
    const values = response.values || [];
    
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
      await this.apiClient.updateValues(sheetName, [newHeaders, newSchema]);
      
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
   * Get sheet headers (first row)
   */
  async getSheetHeaders(sheetName: string): Promise<string[]> {
    const response = await this.apiClient.getValues(sheetName, '1:1');
    return response.values?.[0] || [];
  }

  /**
   * Freeze header rows in a sheet
   */
  async freezeHeaderRows(sheetName: string, rowCount: number): Promise<void> {
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
      
      await this.apiClient.batchUpdate(requestBody);
      sheetLogger.info('Successfully froze header rows');
    } catch (error) {
      sheetLogger.error('Error freezing header rows', error instanceof Error ? error : new Error(String(error)));
      throw error; // Re-throw instead of just warning
    }
  }

  /**
   * Get sheet ID by name
   */
  async getSheetId(sheetName: string): Promise<number> {
    const data = await this.apiClient.getSpreadsheetMetadata();
    const sheet = data.sheets.find(s => s.properties.title === sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet ${sheetName} not found`);
    }
    
    return sheet.properties.sheetId;
  }
}