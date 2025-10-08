/**
 * Google Sheets Data Service
 *
 * Handles data CRUD operations on sheets
 * - Get sheet data
 * - Update rows
 * - Append rows
 */

import { columnIndexToLetter } from '../utils/column';

export class GoogleSheetsDataService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get all data from a sheet as an array of objects with column names as keys
   *
   * @param spreadsheetId - Spreadsheet ID
   * @param sheetTitle - Sheet title
   * @returns Array of row objects (columns starting with _ are excluded)
   */
  async getSheetData(
    spreadsheetId: string,
    sheetTitle: string,
    options?: { includePrivateColumns?: boolean }
  ): Promise<Array<Record<string, string | number | boolean>>> {
    // Get headers (row 1) and all data (from row 3 onwards)
    const headersResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!1:1`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!headersResponse.ok) {
      const error = await headersResponse.text();
      throw new Error(
        `Failed to get sheet headers: ${headersResponse.status} ${error}`
      );
    }

    const headersData = (await headersResponse.json()) as {
      values?: Array<Array<string>>;
    };

    const headers = headersData.values?.[0] || [];

    // Get all data rows (starting from row 3 to skip header and column definition rows)
    const dataResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!A3:${columnIndexToLetter(headers.length)}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!dataResponse.ok) {
      const error = await dataResponse.text();
      throw new Error(
        `Failed to get sheet data: ${dataResponse.status} ${error}`
      );
    }

    const data = (await dataResponse.json()) as {
      values?: Array<Array<string | number | boolean>>;
    };

    const rows = data.values || [];

    // Convert rows to objects using headers as keys
    // Exclude columns starting with _ unless includePrivateColumns is true
    const includePrivate = options?.includePrivateColumns ?? false;
    return rows.map((row) => {
      const rowObject: Record<string, string | number | boolean> = {};
      headers.forEach((header, index) => {
        if (includePrivate || !header.startsWith('_')) {
          rowObject[header] = row[index] ?? '';
        }
      });
      return rowObject;
    });
  }

  /**
   * Update a specific row in a sheet by object_id
   *
   * @param spreadsheetId - Spreadsheet ID
   * @param sheetTitle - Sheet title
   * @param objectId - The object_id to find and update
   * @param rowData - Object with column names as keys and new values
   */
  async updateRow(
    spreadsheetId: string,
    sheetTitle: string,
    objectId: string,
    rowData: Record<string, string | number | boolean>
  ): Promise<void> {
    // Get headers to know column order
    const headersResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!1:1`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!headersResponse.ok) {
      const error = await headersResponse.text();
      throw new Error(
        `Failed to get sheet headers: ${headersResponse.status} ${error}`
      );
    }

    const headersData = (await headersResponse.json()) as {
      values?: Array<Array<string>>;
    };

    const headers = headersData.values?.[0] || [];

    // Get all data to find the row with matching object_id
    const allDataResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!A3:${columnIndexToLetter(headers.length)}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!allDataResponse.ok) {
      const error = await allDataResponse.text();
      throw new Error(
        `Failed to get sheet data: ${allDataResponse.status} ${error}`
      );
    }

    const allData = (await allDataResponse.json()) as {
      values?: Array<Array<string | number | boolean>>;
    };

    const rows = allData.values || [];

    // Find row index by object_id (first column)
    const rowIndex = rows.findIndex((row) => row[0] === objectId);

    if (rowIndex === -1) {
      throw new Error(
        `Row with object_id "${objectId}" not found in sheet "${sheetTitle}"`
      );
    }

    // Calculate actual row number (add 3: 1 for header, 1 for column defs, 1 for 1-based indexing)
    const actualRowNumber = rowIndex + 3;

    // Build values array in the correct column order
    const values = headers.map((header) => {
      if (header in rowData) {
        return rowData[header];
      }
      // Keep existing value if not provided in rowData
      const existingRow = rows[rowIndex];
      const columnIndex = headers.indexOf(header);
      return existingRow[columnIndex] ?? '';
    });

    const columnLetter = columnIndexToLetter(values.length);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!A${actualRowNumber}:${columnLetter}${actualRowNumber}?valueInputOption=RAW`,
      {
        method: 'PUT',
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
      throw new Error(`Failed to update row: ${response.status} ${error}`);
    }
  }

  /**
   * Add a row to a sheet
   *
   * @param spreadsheetId - Spreadsheet ID
   * @param sheetTitle - Sheet title
   * @param rowData - Object with column names as keys and values
   */
  async appendRow(
    spreadsheetId: string,
    sheetTitle: string,
    rowData: Record<string, string | number | boolean>
  ): Promise<void> {
    // Get headers to know column order
    const headersResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!1:1`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!headersResponse.ok) {
      const error = await headersResponse.text();
      throw new Error(
        `Failed to get sheet headers: ${headersResponse.status} ${error}`
      );
    }

    const headersData = (await headersResponse.json()) as {
      values?: Array<Array<string>>;
    };

    const headers = headersData.values?.[0] || [];

    // Build values array in the correct column order
    const values = headers.map((header) => {
      if (header in rowData) {
        return rowData[header];
      }
      // Return empty string for missing columns
      return '';
    });

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!A:${columnIndexToLetter(headers.length)}:append?valueInputOption=RAW`,
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
