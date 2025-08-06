/**
 * Common types and interfaces for sheet-legacy service
 */

/**
 * Google Sheets API response format for values
 */
export interface SheetsValuesResponse {
  values?: string[][];
}

/**
 * Google Sheets API response format for spreadsheet metadata
 */
export interface SheetsMetadataResponse {
  sheets: Array<{
    properties: {
      sheetId: number;
      title: string;
    };
  }>;
}

/**
 * Internal configuration for SheetService
 */
export interface SheetServiceConfig {
  spreadsheetId: string | null;
  accessToken: string | null;
}

/**
 * Batch update request structure for Google Sheets API
 */
export interface BatchUpdateRequest {
  requests: BatchUpdateRequestItem[];
}

export interface BatchUpdateRequestItem {
  addSheet?: {
    properties: {
      title: string;
      gridProperties?: {
        frozenRowCount?: number;
      };
    };
  };
  deleteDimension?: {
    range: {
      sheetId: number;
      dimension: 'ROWS' | 'COLUMNS';
      startIndex: number;
      endIndex: number;
    };
  };
  updateSheetProperties?: {
    properties: {
      sheetId: number;
      gridProperties: {
        frozenRowCount: number;
      };
    };
    fields: string;
  };
}

/**
 * Values update request structure for Google Sheets API
 */
export interface ValuesUpdateRequest {
  values: string[][];
}