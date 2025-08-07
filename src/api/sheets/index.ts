import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { SheetService } from '../../services/sheet-legacy';
import { ConfigService } from '../../services/config';
import type { SheetsListQuery, SheetInfo, ColumnInfo, SheetsListResponse } from '../v1/sheets/types';

/**
 * Interface for Google Sheets API response
 */
interface SheetsMetadataResponse {
  sheets: Array<{
    properties: {
      title: string;
      sheetId: number;
      gridProperties?: {
        rowCount?: number;
        columnCount?: number;
      };
    };
  }>;
}

/**
 * Interface for sheet values response from Google Sheets API
 */
interface SheetsValuesResponse {
  values?: string[][];
  range?: string;
}

/**
 * Check if a sheet name is a system sheet (starts with underscore)
 */
function isSystemSheet(sheetName: string): boolean {
  return sheetName.startsWith('_');
}

/**
 * Validate master key against configured master key
 * Simplified implementation since ACLService doesn't exist yet
 */
async function validateMasterKey(providedKey: string, env: Env): Promise<boolean> {
  try {
    // Get configured master key from environment or config
    const configuredMasterKey = env.MASTER_KEY;
    if (!configuredMasterKey) {
      return false;
    }
    
    // Use constant-time comparison to prevent timing attacks
    if (providedKey.length !== configuredMasterKey.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < providedKey.length; i++) {
      result |= providedKey.charCodeAt(i) ^ configuredMasterKey.charCodeAt(i);
    }
    return result === 0;
  } catch (error) {
    console.error('Master key validation error:', error);
    return false;
  }
}

/**
 * Parse column schema from sheet's second row (schema row)
 */
function parseColumnInfo(headers: string[], schemaRow?: string[]): ColumnInfo[] {
  return headers.map((name, index) => {
    const schemaInfo = schemaRow?.[index] || 'string';
    
    // Basic schema parsing - in production this would be more sophisticated
    const columnInfo: ColumnInfo = {
      name,
      type: schemaInfo
    };

    // Extract additional properties from schema string if present
    if (schemaInfo.includes('required')) {
      columnInfo.required = true;
    }

    return columnInfo;
  });
}


/**
 * Get sheets list handler
 * Implements GET /api/v1/sheets endpoint
 */
export async function getSheetsHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    // Check for master key authentication
    const masterKeyHeader = c.req.header('x-master-key');
    const isMasterKey = masterKeyHeader ? await validateMasterKey(masterKeyHeader, c.env) : false;
    
    const query: SheetsListQuery = {
      filter: c.req.query('filter')
    };

    // Determine if system sheets should be included
    const includeSystem = isMasterKey;

    // Initialize sheet service
    const sheetService = SheetService.getInstance();
    await sheetService.initialize();

    // Get spreadsheet metadata
    const metadata = await sheetService.getSpreadsheetMetadata();

    // Process each sheet to get column information
    const allSheets: Array<{ name: string; columns: ColumnInfo[] }> = [];

    for (const sheet of metadata.sheets) {
      const sheetName = sheet.properties.title;

      // Apply filter if specified
      if (query.filter && !sheetName.toLowerCase().includes(query.filter.toLowerCase())) {
        continue;
      }

      try {
        // Get sheet data to extract headers and schema
        const valuesResponse = await sheetService.getSheetValues(sheetName, '1:2');
        
        if (valuesResponse?.values && valuesResponse.values.length > 0) {
          const headers = valuesResponse.values[0] || [];
          const schemaRow = valuesResponse.values[1]; // Second row contains schema info
          
          const columns = parseColumnInfo(headers, schemaRow);
          
          allSheets.push({
            name: sheetName,
            columns
          });
        } else {
          // Sheet exists but has no data - still include it with empty columns
          allSheets.push({
            name: sheetName,
            columns: []
          });
        }
      } catch (error) {
        console.error(`Error processing sheet ${sheetName}:`, error);
        // Include sheet with empty columns if we can't read its structure
        allSheets.push({
          name: sheetName,
          columns: []
        });
      }
    }

    // Filter sheets based on permissions  
    const accessibleSheets = includeSystem 
      ? allSheets // Master key access includes all sheets
      : allSheets.filter(sheet => !isSystemSheet(sheet.name));

    // Calculate statistics
    const totalSheets = allSheets.length;
    const accessibleCount = accessibleSheets.length;
    const systemSheetCount = accessibleSheets.filter(sheet => isSystemSheet(sheet.name)).length;

    // Build response
    const response: SheetsListResponse = {
      success: true,
      data: {
        sheets: accessibleSheets.map(sheet => ({
          name: sheet.name,
          columns: sheet.columns
        })),
        total: totalSheets,
        accessible_count: accessibleCount,
        ...(systemSheetCount > 0 && { system_sheet_count: systemSheetCount })
      },
      meta: {
        is_master_key_auth: isMasterKey,
        include_system: includeSystem,
        ...(query.filter && { filter_applied: query.filter })
      }
    };

    return c.json(response, 200);

  } catch (error) {
    console.error('Error in getSheetsHandler:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      env: {
        hasGoogleClientId: !!c.env.GOOGLE_CLIENT_ID,
        hasGoogleClientSecret: !!c.env.GOOGLE_CLIENT_SECRET,
        hasMasterKey: !!c.env.MASTER_KEY
      }
    });
    
    return c.json({
      success: false,
      error: 'sheets_fetch_failed',
      message: 'Failed to retrieve sheet information'
    }, 500);
  }
}

