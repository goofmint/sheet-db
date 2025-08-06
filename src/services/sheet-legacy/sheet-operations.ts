import { SheetApiClient } from './sheet-api-client';
import { SheetStructureManager } from './sheet-structure-manager';
import { logger } from '../../utils/logger';

/**
 * Handles CRUD operations for sheet records
 */
export class SheetOperations {
  constructor(
    private apiClient: SheetApiClient,
    private structureManager: SheetStructureManager
  ) {}

  /**
   * Get all data from a sheet
   */
  async getSheetData<T>(sheetName: string): Promise<T[]> {
    const response = await this.apiClient.getValues(sheetName);
    const values = response.values || [];

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
   * Update sheet data (replaces all data)
   */
  async updateSheetData(sheetName: string, data: string[][]): Promise<void> {
    await this.apiClient.updateValues(sheetName, data);
  }

  /**
   * Add a new record to a sheet
   */
  async addRecord<T>(sheetName: string, record: T): Promise<void> {
    // Get headers to determine the structure
    const headers = await this.structureManager.getSheetHeaders(sheetName);
    
    // Convert record to row values
    const rowValues = headers.map(header => {
      const value = (record as Record<string, unknown>)[header];
      if (Array.isArray(value)) {
        return value.join(',');
      } else if (typeof value === 'boolean') {
        return value.toString();
      } else {
        return value?.toString() || '';
      }
    });

    // Append the new row
    await this.apiClient.appendValues(sheetName, [rowValues]);
  }

  /**
   * Update a record by ID
   */
  async updateRecord<T>(sheetName: string, id: string, record: T): Promise<void> {
    // Get all data to find the row index
    const response = await this.apiClient.getValues(sheetName);
    const values = response.values || [];
    
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
      const value = (record as Record<string, unknown>)[header];
      if (Array.isArray(value)) {
        return value.join(',');
      } else if (typeof value === 'boolean') {
        return value.toString();
      } else {
        return value?.toString() || '';
      }
    });

    // Update the specific row
    await this.apiClient.updateValues(sheetName, [rowValues], `A${rowIndex}`);
  }

  /**
   * Delete a record by ID
   */
  async deleteRecord(sheetName: string, id: string): Promise<boolean> {
    const deleteLogger = logger.child({
      operation: 'deleteRecord',
      sheetName,
      recordId: id
    });
    
    deleteLogger.debug('Starting record deletion');

    // Get all data to find the row index
    const response = await this.apiClient.getValues(sheetName);
    const values = response.values || [];
    
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

    try {
      // Get the actual sheet ID for the target sheet
      const sheetId = await this.structureManager.getSheetId(sheetName);
      deleteLogger.debug('Retrieved sheet ID for deletion', { sheetId, rowIndex });
      
      // Delete the row using batchUpdate
      await this.apiClient.batchUpdate({
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
      });

      deleteLogger.info('Successfully deleted record');
      return true;
    } catch (error) {
      deleteLogger.error('Failed to delete record', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
}