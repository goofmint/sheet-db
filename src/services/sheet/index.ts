import { createSheetRow } from './create';
import { findSheetRows, findSheetRow } from './find';
import { updateSheetRow } from './update';
import { 
  ISheetService, 
  SheetCreateOptions, 
  SheetFindOptions, 
  SheetUpdateOptions, 
  SheetOperationResult,
  SheetACL
} from './types';

/**
 * Google Sheetsサービスの実装
 */
export class SheetService implements ISheetService {
  
  async create(options: SheetCreateOptions): Promise<SheetOperationResult> {
    return createSheetRow(options);
  }

  async find(options: SheetFindOptions): Promise<SheetOperationResult> {
    return findSheetRows(options);
  }

  async update(options: SheetUpdateOptions): Promise<SheetOperationResult> {
    return updateSheetRow(options);
  }

  async delete(sheetName: string, filter: { column: string; value: string | number | boolean }): Promise<SheetOperationResult> {
    // TODO: delete実装
    return {
      success: false,
      error: 'Delete operation not implemented yet'
    };
  }

  async exists(sheetName: string): Promise<boolean> {
    // TODO: exists実装
    return false;
  }

  async createSheet(sheetName: string, headers: string[], acl?: SheetACL): Promise<SheetOperationResult> {
    try {
      const { ConfigService } = await import('../config');
      const { GoogleOAuthService } = await import('../google-oauth');
      
      const spreadsheetId = ConfigService.getString('google.sheetId');
      if (!spreadsheetId) {
        return {
          success: false,
          error: 'Google Sheet ID not configured'
        };
      }

      const googleOAuth = new GoogleOAuthService();
      const accessToken = await googleOAuth.getValidAccessToken();

      // Check if sheet already exists
      const existsResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      if (!existsResponse.ok) {
        return {
          success: false,
          error: 'Failed to access spreadsheet'
        };
      }

      const spreadsheetData = await existsResponse.json() as { sheets: Array<{ properties: { title: string, sheetId: number } }> };
      const existingSheet = spreadsheetData.sheets.find(s => s.properties.title === sheetName);
      
      if (existingSheet) {
        return {
          success: false,
          error: `Sheet ${sheetName} already exists`
        };
      }

      // Create new sheet with headers
      const batchUpdateRequest = {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
                gridProperties: {
                  rowCount: 1000,
                  columnCount: headers.length || 26,
                  frozenRowCount: 2 // Freeze header rows
                }
              }
            }
          }
        ]
      };

      const createResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(batchUpdateRequest)
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        return {
          success: false,
          error: `Failed to create sheet: ${errorText}`
        };
      }

      const createResult = await createResponse.json() as { 
        replies: Array<{ addSheet?: { properties: { sheetId: number, title: string } } }> 
      };
      
      const newSheetId = createResult.replies[0]?.addSheet?.properties?.sheetId;
      
      if (!newSheetId) {
        return {
          success: false,
          error: 'Failed to get new sheet ID'
        };
      }

      // Add headers if provided
      if (headers && headers.length > 0) {
        const escapedSheetName = sheetName.replace(/'/g, "''");
        const range = `'${escapedSheetName}'!A1`;
        
        const updateResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              values: [headers]
            })
          }
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          return {
            success: false,
            error: `Failed to set headers: ${errorText}`
          };
        }
      }

      return {
        success: true,
        data: {
          id: String(newSheetId),
          name: sheetName,
          url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${newSheetId}`,
          createdAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

// デフォルトインスタンスをエクスポート
export const sheetService = new SheetService();

// 型とヘルパー関数もエクスポート
export * from './types';
export { UserSheetService } from './user';