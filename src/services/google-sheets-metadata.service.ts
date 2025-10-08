/**
 * Google Sheets Metadata Service
 *
 * Handles spreadsheet and sheet metadata operations
 * - List spreadsheets from Google Drive
 * - Get spreadsheet metadata
 * - Check sheet existence
 */

import type { SpreadsheetMetadata, SpreadsheetInfo } from '../types/google';

export class GoogleSheetsMetadataService {
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
    const allFiles: Array<{
      id: string;
      name: string;
      webViewLink: string;
      createdTime: string;
      modifiedTime: string;
    }> = [];

    let pageToken: string | undefined;

    // Implement pagination to retrieve all files
    do {
      const params = new URLSearchParams({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields:
          'files(id,name,webViewLink,createdTime,modifiedTime),nextPageToken',
        orderBy: 'modifiedTime desc',
        pageSize: '100',
      });

      if (pageToken) {
        params.set('pageToken', pageToken);
      }

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
        console.error(
          '[GoogleSheetsMetadataService] API Error:',
          response.status,
          error
        );
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
        nextPageToken?: string;
      };

      if (data.files) {
        allFiles.push(...data.files);
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    return allFiles.map((file) => ({
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
  async getSheetIdByTitle(
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
}
