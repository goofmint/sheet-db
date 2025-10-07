/**
 * Google Sheets Service
 *
 * Handles Google Sheets API operations using fetch-based REST API
 * Compatible with Cloudflare Workers runtime
 *
 * Uses Google Drive API v3 and Google Sheets API v4
 */

import type {
  SpreadsheetMetadata,
  SpreadsheetInfo,
  ValidationResult,
} from '../types/google';

export class GoogleSheetsService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * List available spreadsheets from Google Drive
   *
   * @returns Array of spreadsheet metadata
   */
  async listSpreadsheets(): Promise<SpreadsheetMetadata[]> {
    const params = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id,name,webViewLink,createdTime,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: '100',
    });

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[GoogleSheetsService] API Error:', response.status, error);
      throw new Error(
        `Failed to list spreadsheets: ${response.status} ${error}`
      );
    }

    const data = (await response.json()) as {
      files?: Array<{
        id: string;
        name: string;
        webViewLink: string;
        createdTime: string;
        modifiedTime: string;
      }>;
    };

    console.log('[GoogleSheetsService] API Response:', data);

    if (!data.files) {
      console.warn('[GoogleSheetsService] No files array in response');
      return [];
    }

    return data.files.map((file) => ({
      id: file.id,
      name: file.name,
      url: file.webViewLink,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
    }));
  }

  /**
   * Get spreadsheet metadata including sheet information
   *
   * @param sheetId - Spreadsheet ID
   * @returns Spreadsheet information with sheets
   */
  async getSpreadsheetMetadata(sheetId: string): Promise<SpreadsheetInfo> {
    const params = new URLSearchParams({
      fields:
        'spreadsheetId,properties.title,sheets(properties(sheetId,title,index,gridProperties))',
    });

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?${params}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to get spreadsheet metadata: ${response.status} ${error}`
      );
    }

    const data = (await response.json()) as {
      spreadsheetId: string;
      properties: { title: string };
      sheets: Array<{
        properties: {
          sheetId: number;
          title: string;
          index: number;
          gridProperties: {
            rowCount: number;
            columnCount: number;
          };
        };
      }>;
    };

    return {
      id: data.spreadsheetId,
      name: data.properties.title,
      sheets: data.sheets.map((sheet) => ({
        sheetId: sheet.properties.sheetId,
        title: sheet.properties.title,
        index: sheet.properties.index,
        rowCount: sheet.properties.gridProperties.rowCount,
        columnCount: sheet.properties.gridProperties.columnCount,
      })),
    };
  }

  /**
   * Check if a sheet exists in the spreadsheet
   *
   * @param sheetId - Spreadsheet ID
   * @param sheetTitle - Sheet title to check
   * @returns True if sheet exists
   */
  async sheetExists(sheetId: string, sheetTitle: string): Promise<boolean> {
    const metadata = await this.getSpreadsheetMetadata(sheetId);
    return metadata.sheets.some((s) => s.title === sheetTitle);
  }

  /**
   * Get sheet ID by title
   *
   * @param spreadsheetId - Spreadsheet ID
   * @param sheetTitle - Sheet title
   * @returns Sheet ID (numeric)
   */
  private async getSheetIdByTitle(
    spreadsheetId: string,
    sheetTitle: string
  ): Promise<number> {
    const metadata = await this.getSpreadsheetMetadata(spreadsheetId);
    const sheet = metadata.sheets.find((s) => s.title === sheetTitle);
    if (!sheet) {
      throw new Error(`Sheet "${sheetTitle}" not found`);
    }
    return sheet.sheetId;
  }

  /**
   * Create a new sheet with headers
   *
   * @param spreadsheetId - Spreadsheet ID
   * @param sheetTitle - Title for new sheet
   * @param headers - Array of header column names
   */
  async createSheetWithHeaders(
    spreadsheetId: string,
    sheetTitle: string,
    headers: string[]
  ): Promise<void> {
    // 1. Create new sheet
    const createRequest = {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetTitle,
              gridProperties: {
                rowCount: 1000,
                columnCount: headers.length,
                frozenRowCount: 1,
              },
            },
          },
        },
      ],
    };

    const createResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createRequest),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create sheet: ${createResponse.status} ${error}`);
    }

    // 2. Set header values
    const columnLetter = String.fromCharCode(64 + headers.length); // A=65, so headers.length columns
    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!A1:${columnLetter}1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [headers],
        }),
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to set headers: ${updateResponse.status} ${error}`);
    }

    // 3. Format header row (bold, background color)
    const sheetId = await this.getSheetIdByTitle(spreadsheetId, sheetTitle);
    const formatRequest = {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                textFormat: { bold: true },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
      ],
    };

    const formatResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formatRequest),
      }
    );

    if (!formatResponse.ok) {
      const error = await formatResponse.text();
      throw new Error(`Failed to format headers: ${formatResponse.status} ${error}`);
    }
  }

  /**
   * Validate sheet structure (check for required sheets and columns)
   *
   * @param sheetId - Spreadsheet ID
   * @returns Validation result
   */
  async validateSheetStructure(sheetId: string): Promise<ValidationResult> {
    const metadata = await this.getSpreadsheetMetadata(sheetId);

    const usersSheet = metadata.sheets.find((s) => s.title === '_Users');
    const rolesSheet = metadata.sheets.find((s) => s.title === '_Roles');
    const filesSheet = metadata.sheets.find((s) => s.title === '_Files');

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!usersSheet) {
      errors.push('Required sheet "_Users" not found');
    }
    if (!rolesSheet) {
      errors.push('Required sheet "_Roles" not found');
    }
    if (!filesSheet) {
      errors.push('Required sheet "_Files" not found');
    }

    // Validate _Users columns if sheet exists
    if (usersSheet) {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/_Users!A1:Z1`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = (await response.json()) as {
          values?: string[][];
        };
        const columns = data.values?.[0] || [];

        const requiredColumns = [
          'id',
          'email',
          'name',
          'password_hash',
          'role',
          'created_at',
          'updated_at',
        ];
        for (const col of requiredColumns) {
          if (!columns.includes(col)) {
            errors.push(`_Users sheet missing required column: ${col}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      hasUsersSheet: !!usersSheet,
      hasRolesSheet: !!rolesSheet,
      hasFilesSheet: !!filesSheet,
    };
  }

  /**
   * Add a row to a sheet
   *
   * @param spreadsheetId - Spreadsheet ID
   * @param sheetTitle - Sheet title
   * @param values - Array of cell values
   */
  async appendRow(
    spreadsheetId: string,
    sheetTitle: string,
    values: Array<string | number | boolean>
  ): Promise<void> {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!A:Z:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [values],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to append row: ${response.status} ${error}`);
    }
  }
}
