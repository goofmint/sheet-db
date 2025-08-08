import type { Context } from 'hono';
import type { Env } from '@/types/env';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import { ConfigRepository } from '@/repositories/config';
import type { SheetsListQuery, ColumnInfo, SheetsListResponse } from './types';
import { SheetService } from '@/services/sheet-legacy';


/**
 * Check if a sheet name is a system sheet (starts with underscore)
 */
function isSystemSheet(sheetName: string): boolean {
  return sheetName.startsWith('_');
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
    // Initialize ConfigService with database connection
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }

    // Check for master key authentication
    const masterKeyHeader = c.req.header('x-master-key');
    let isMasterKey = false;
    
    if (masterKeyHeader) {
      const configRepo = new ConfigRepository(db);
      isMasterKey = await configRepo.verifyMasterKey(masterKeyHeader);
    }
    
    const query: SheetsListQuery = {
      filter: c.req.query('filter')
    };

    // Determine if system sheets should be included
    const includeSystem = isMasterKey;

    // Check configuration before attempting initialization
    const spreadsheetId = ConfigService.getString('google.sheetId');
    const accessToken = ConfigService.getString('google.access_token');
    
    if (!spreadsheetId || !accessToken) {
      // Configuration is incomplete - return 503 without attempting initialization
      return c.json({
        success: false,
        error: 'service_not_configured',
        message: 'Google Sheets service is not properly configured. Please complete the setup first.'
      }, 503); // Service Unavailable
    }

    // Initialize sheet service (should succeed since config is available)
    const sheetService = SheetService.getInstance();
    
    try {
      await sheetService.initialize();
    } catch (initError) {
      // Unexpected initialization error even with valid config
      console.error('Unexpected SheetService initialization failed:', initError);
      return c.json({
        success: false,
        error: 'service_not_configured',
        message: 'Google Sheets service is not properly configured. Please complete the setup first.'
      }, 503); // Service Unavailable
    }

    // Get spreadsheet metadata
    let metadata;
    try {
      metadata = await sheetService.getSpreadsheetMetadata();
    } catch (metadataError) {
      console.error('Failed to get spreadsheet metadata:', metadataError);
      if (metadataError instanceof Error && metadataError.message.includes('Unauthorized')) {
        return c.json({
          success: false,
          error: 'authentication_failed',
          message: 'Google Sheets authentication failed. Please check your access token configuration.'
        }, 401);
      }
      throw metadataError; // Re-throw other errors
    }

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
    
    return c.json({
      success: false,
      error: 'sheets_fetch_failed',
      message: 'Failed to retrieve sheet information'
    }, 500);
  }
}