/**
 * Google Sheets Service (Facade)
 *
 * Unified interface for Google Sheets operations
 * Delegates to specialized services:
 * - GoogleSheetsMetadataService: Spreadsheet and sheet metadata
 * - GoogleSheetsSchemaService: Sheet creation and validation
 * - GoogleSheetsDataService: Data CRUD operations
 *
 * Uses Google Drive API v3 and Google Sheets API v4
 * Compatible with Cloudflare Workers runtime
 */

import type {
  SpreadsheetMetadata,
  SpreadsheetInfo,
  ValidationResult,
} from '../types/google';
import { GoogleSheetsMetadataService } from './google-sheets-metadata.service';
import { GoogleSheetsSchemaService } from './google-sheets-schema.service';
import { GoogleSheetsDataService } from './google-sheets-data.service';

export class GoogleSheetsService {
  private metadataService: GoogleSheetsMetadataService;
  private schemaService: GoogleSheetsSchemaService;
  private dataService: GoogleSheetsDataService;

  constructor(accessToken: string) {
    this.metadataService = new GoogleSheetsMetadataService(accessToken);
    this.schemaService = new GoogleSheetsSchemaService(accessToken);
    this.dataService = new GoogleSheetsDataService(accessToken);
  }

  // === Metadata Operations ===

  /**
   * List available spreadsheets from Google Drive
   *
   * @returns Array of spreadsheet metadata
   */
  async listSpreadsheets(): Promise<SpreadsheetMetadata[]> {
    return this.metadataService.listSpreadsheets();
  }

  /**
   * Get spreadsheet metadata including sheet information
   *
   * @param sheetId - Spreadsheet ID
   * @returns Spreadsheet information with sheets
   */
  async getSpreadsheetMetadata(sheetId: string): Promise<SpreadsheetInfo> {
    return this.metadataService.getSpreadsheetMetadata(sheetId);
  }

  /**
   * Check if a sheet exists in the spreadsheet
   *
   * @param sheetId - Spreadsheet ID
   * @param sheetTitle - Sheet title to check
   * @returns True if sheet exists
   */
  async sheetExists(sheetId: string, sheetTitle: string): Promise<boolean> {
    return this.metadataService.sheetExists(sheetId, sheetTitle);
  }

  // === Schema Operations ===

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
    return this.schemaService.createSheetWithHeaders(
      spreadsheetId,
      sheetTitle,
      headers,
      columnDefs
    );
  }

  /**
   * Validate sheet structure (check for required sheets and columns)
   *
   * @param sheetId - Spreadsheet ID
   * @returns Validation result
   */
  async validateSheetStructure(sheetId: string): Promise<ValidationResult> {
    return this.schemaService.validateSheetStructure(sheetId);
  }

  // === Data Operations ===

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
    return this.dataService.getSheetData(spreadsheetId, sheetTitle, options);
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
    return this.dataService.updateRow(
      spreadsheetId,
      sheetTitle,
      objectId,
      rowData
    );
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
    return this.dataService.appendRow(spreadsheetId, sheetTitle, rowData);
  }
}
