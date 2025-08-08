import { ConfigService } from '../config';
import { SheetApiClient } from './sheet-api-client';
import { SheetStructureManager } from './sheet-structure-manager';
import { SheetOperations } from './sheet-operations';
import { SheetServiceConfig } from './types';

/**
 * Google Sheets API service
 * Handles all Google Sheets operations using a modular architecture
 */
export class SheetService {
  private static instance: SheetService;
  private config: SheetServiceConfig = {
    spreadsheetId: null,
    accessToken: null
  };

  private apiClient?: SheetApiClient;
  private structureManager?: SheetStructureManager;
  private operations?: SheetOperations;

  private constructor() {
    // Components will be initialized lazily after config is populated
  }

  static getInstance(): SheetService {
    if (!SheetService.instance) {
      SheetService.instance = new SheetService();
    }
    return SheetService.instance;
  }

  /**
   * Initialize with current configuration
   */
  async initialize(): Promise<void> {
    this.config.spreadsheetId = ConfigService.getString('google.sheetId');
    
    // Use GoogleOAuthService to get a valid access token
    const { GoogleOAuthService } = await import('../google-oauth');
    const googleOAuth = new GoogleOAuthService();
    
    try {
      this.config.accessToken = await googleOAuth.getValidAccessToken();
    } catch (error) {
      // If refresh fails, try to get stored access token as fallback
      const storedToken = ConfigService.getString('google.access_token');
      if (storedToken) {
        this.config.accessToken = storedToken;
      } else {
        throw new Error('Google access token not available: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }

    if (!this.config.spreadsheetId) {
      throw new Error('Google Sheet ID not configured');
    }
    if (!this.config.accessToken) {
      throw new Error('Google access token not available');
    }

    // Initialize components with populated config
    this.apiClient = new SheetApiClient(this.config);
    this.structureManager = new SheetStructureManager(this.apiClient);
    this.operations = new SheetOperations(this.apiClient, this.structureManager);
  }

  /**
   * Create a new sheet with initial data, or update existing sheet structure
   */
  async createSheet(title: string, data: string[][]): Promise<void> {
    await this.ensureInitialized();
    if (!this.structureManager) throw new Error('SheetService not initialized');
    await this.structureManager.createSheet(title, data);
  }

  /**
   * Update sheet data (replaces all data)
   */
  async updateSheetData(sheetName: string, data: string[][]): Promise<void> {
    await this.ensureInitialized();
    if (!this.operations) throw new Error('SheetService not initialized');
    await this.operations.updateSheetData(sheetName, data);
  }

  /**
   * Get all data from a sheet
   */
  async getSheetData<T>(sheetName: string): Promise<T[]> {
    await this.ensureInitialized();
    if (!this.operations) throw new Error('SheetService not initialized');
    return await this.operations.getSheetData<T>(sheetName);
  }

  /**
   * Add a new record to a sheet
   */
  async addRecord<T>(sheetName: string, record: T): Promise<void> {
    await this.ensureInitialized();
    if (!this.operations) throw new Error('SheetService not initialized');
    await this.operations.addRecord<T>(sheetName, record);
  }

  /**
   * Update a record by ID
   */
  async updateRecord<T>(sheetName: string, id: string, record: T): Promise<void> {
    await this.ensureInitialized();
    if (!this.operations) throw new Error('SheetService not initialized');
    await this.operations.updateRecord<T>(sheetName, id, record);
  }

  /**
   * Delete a record by ID
   */
  async deleteRecord(sheetName: string, id: string): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.operations) throw new Error('SheetService not initialized');
    return await this.operations.deleteRecord(sheetName, id);
  }

  /**
   * Get spreadsheet metadata
   */
  async getSpreadsheetMetadata(): Promise<any> {
    await this.ensureInitialized();
    if (!this.apiClient) throw new Error('SheetService not initialized');
    return await this.apiClient.getSpreadsheetMetadata();
  }

  /**
   * Get sheet values
   */
  async getSheetValues(sheetName: string, range?: string): Promise<any> {
    await this.ensureInitialized();
    if (!this.apiClient) throw new Error('SheetService not initialized');
    return await this.apiClient.getValues(sheetName, range);
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.config.spreadsheetId || !this.config.accessToken) {
      await this.initialize();
    }
  }
}