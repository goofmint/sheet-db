import { google, sheets_v4 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export interface SheetDBConfig {
  spreadsheetId: string;
  sheetName: string;
  credentials?: any;
  keyFile?: string;
}

export interface Record {
  [key: string]: any;
}

export class SheetDB {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;
  private sheetName: string;
  private headers: string[] = [];

  constructor(private config: SheetDBConfig) {
    this.spreadsheetId = config.spreadsheetId;
    this.sheetName = config.sheetName;
    
    const auth = new GoogleAuth({
      credentials: config.credentials,
      keyFile: config.keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
  }

  /**
   * Initialize the database by reading headers from the first row
   */
  async initialize(): Promise<void> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!1:1`,
    });

    const rows = response.data.values;
    if (rows && rows.length > 0) {
      this.headers = rows[0];
    } else {
      throw new Error('Sheet has no headers. Please add headers in the first row.');
    }
  }

  /**
   * Get all records from the sheet
   */
  async getAll(): Promise<Record[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const headers = rows[0];
    const records: Record[] = [];

    for (let i = 1; i < rows.length; i++) {
      const record: Record = {};
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = rows[i][j] || '';
      }
      records.push(record);
    }

    return records;
  }

  /**
   * Get a single record by matching a field value
   */
  async getOne(field: string, value: any): Promise<Record | null> {
    const records = await this.getAll();
    return records.find(record => record[field] === value) || null;
  }

  /**
   * Create a new record
   */
  async create(data: Record): Promise<Record> {
    if (this.headers.length === 0) {
      await this.initialize();
    }

    const values = this.headers.map(header => data[header] || '');

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    return data;
  }

  /**
   * Update a record by matching a field value
   */
  async update(field: string, value: any, data: Record): Promise<Record | null> {
    const records = await this.getAll();
    const index = records.findIndex(record => record[field] === value);

    if (index === -1) {
      return null;
    }

    const rowNumber = index + 2; // +1 for header, +1 for 0-based index
    const values = this.headers.map(header => data[header] !== undefined ? data[header] : records[index][header]);

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A${rowNumber}:Z${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    const updatedRecord: Record = {};
    this.headers.forEach((header, i) => {
      updatedRecord[header] = values[i];
    });

    return updatedRecord;
  }

  /**
   * Delete a record by matching a field value
   */
  async delete(field: string, value: any): Promise<boolean> {
    const records = await this.getAll();
    const index = records.findIndex(record => record[field] === value);

    if (index === -1) {
      return false;
    }

    const rowNumber = index + 2; // +1 for header, +1 for 0-based index

    // Get the sheet ID
    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });

    const sheet = spreadsheet.data.sheets?.find(
      s => s.properties?.title === this.sheetName
    );

    if (!sheet || !sheet.properties?.sheetId) {
      throw new Error(`Sheet "${this.sheetName}" not found`);
    }

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: rowNumber - 1,
                endIndex: rowNumber,
              },
            },
          },
        ],
      },
    });

    return true;
  }

  /**
   * Search records by matching multiple criteria
   */
  async search(criteria: Record): Promise<Record[]> {
    const records = await this.getAll();
    return records.filter(record => {
      return Object.keys(criteria).every(key => record[key] === criteria[key]);
    });
  }
}
