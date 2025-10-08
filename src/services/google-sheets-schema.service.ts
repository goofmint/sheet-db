/**
 * Google Sheets Schema Service
 *
 * Handles sheet schema operations
 * - Create sheets with headers and column definitions
 * - Validate sheet structure
 */

import type { ValidationResult } from '../types/google';
import { columnIndexToLetter } from '../utils/column';
import { GoogleSheetsMetadataService } from './google-sheets-metadata.service';

export class GoogleSheetsSchemaService {
  private accessToken: string;
  private metadataService: GoogleSheetsMetadataService;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.metadataService = new GoogleSheetsMetadataService(accessToken);
  }

  /**
   * Create a new sheet with headers and column definitions
   *
   * @param spreadsheetId - Spreadsheet ID
   * @param sheetTitle - Title for new sheet
   * @param headers - Array of header column names
   * @param columnDefs - Array of column definition objects (one per column)
   */
  async createSheetWithHeaders(
    spreadsheetId: string,
    sheetTitle: string,
    headers: string[],
    columnDefs: Record<string, unknown>[]
  ): Promise<void> {
    console.log(
      `[GoogleSheetsSchemaService] Creating sheet "${sheetTitle}" with ${headers.length} columns...`
    );

    // 1. Create new sheet with frozen rows for header (row 1) and column defs (row 2)
    console.log(
      `[GoogleSheetsSchemaService] Step 1/3: Creating sheet structure...`
    );
    const createRequest = {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetTitle,
              gridProperties: {
                rowCount: 1000,
                columnCount: headers.length,
                frozenRowCount: 2, // Freeze both header and column definition rows
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
      throw new Error(
        `Failed to create sheet: ${createResponse.status} ${error}`
      );
    }
    console.log(`[GoogleSheetsSchemaService] ✓ Sheet structure created`);

    // 2. Set header values (row 1) and column definitions (row 2)
    console.log(
      `[GoogleSheetsSchemaService] Step 2/3: Writing headers and column definitions...`
    );
    const columnLetter = columnIndexToLetter(headers.length);
    const columnDefStrings = columnDefs.map((def) => JSON.stringify(def));

    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!A1:${columnLetter}2?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [headers, columnDefStrings], // Row 1: headers, Row 2: column defs
        }),
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(
        `Failed to set headers and column definitions: ${updateResponse.status} ${error}`
      );
    }
    console.log(
      `[GoogleSheetsSchemaService] ✓ Headers and column definitions written`
    );

    // 3. Format header row (row 1) and column definition row (row 2)
    console.log(`[GoogleSheetsSchemaService] Step 3/3: Applying formatting...`);
    const sheetId = await this.metadataService.getSheetIdByTitle(
      spreadsheetId,
      sheetTitle
    );
    const formatRequest = {
      requests: [
        // Format row 1 (headers) - bold with gray background
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
        // Format row 2 (column definitions) - light blue background
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 1,
              endRowIndex: 2,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.85, green: 0.92, blue: 0.95 },
                textFormat: { fontSize: 9 },
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
      throw new Error(
        `Failed to format headers: ${formatResponse.status} ${error}`
      );
    }
    console.log(`[GoogleSheetsSchemaService] ✓ Formatting applied successfully`);
    console.log(
      `[GoogleSheetsSchemaService] ✓✓ Sheet "${sheetTitle}" created successfully`
    );
  }

  /**
   * Validate sheet structure (check for required sheets and columns)
   *
   * @param sheetId - Spreadsheet ID
   * @returns Validation result
   */
  async validateSheetStructure(sheetId: string): Promise<ValidationResult> {
    const metadata = await this.metadataService.getSpreadsheetMetadata(sheetId);

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
          'object_id',
          'username',
          '_password_hash',
          'email',
          'name',
          'status',
          'created_at',
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
}
