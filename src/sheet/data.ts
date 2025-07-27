import { SheetService } from '../services/sheet';

/**
 * Base data interface for all sheet records
 */
export interface BaseRecord {
  id: string;
  created_at: string;
  updated_at: string;
  public_read: boolean;
  public_write: boolean;
  user_read: string[];
  user_write: string[];
  role_read: string[];
  role_write: string[];
}

/**
 * Column definition for sheet schema
 */
export interface ColumnDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'timestamp' | 'string[]';
  required?: boolean;
  unique?: boolean;
  default?: any;
}

/**
 * Base sheet configuration
 */
export interface SheetConfig {
  name: string;
  columns: ColumnDefinition[];
}

/**
 * Default columns for all sheets
 */
export const DEFAULT_COLUMNS: ColumnDefinition[] = [
  { name: 'id', type: 'string', required: true, unique: true },
  { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
  { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
  { name: 'public_read', type: 'boolean', default: true },
  { name: 'public_write', type: 'boolean', default: false },
  { name: 'user_read', type: 'string[]', default: [] },
  { name: 'user_write', type: 'string[]', default: [] },
  { name: 'role_read', type: 'string[]', default: [] },
  { name: 'role_write', type: 'string[]', default: [] }
];

/**
 * Base data service class
 */
export abstract class BaseDataService<T extends BaseRecord> {
  protected sheetService: SheetService;
  protected config: SheetConfig;

  constructor(sheetService: SheetService, config: SheetConfig) {
    this.sheetService = sheetService;
    this.config = config;
  }

  /**
   * Initialize sheet with proper structure
   */
  async initializeSheet(): Promise<void> {
    const allColumns = [...DEFAULT_COLUMNS, ...this.config.columns];
    
    // Create header row
    const headers = allColumns.map(col => col.name);
    
    // Create schema row
    const schema = allColumns.map(col => {
      let schemaStr = col.type;
      if (col.required) schemaStr += '|required';
      if (col.unique) schemaStr += '|unique';
      if (col.default !== undefined) {
        if (typeof col.default === 'string') {
          schemaStr += `|default:${col.default}`;
        } else if (Array.isArray(col.default)) {
          schemaStr += `|default:[]`;
        } else {
          schemaStr += `|default:${col.default}`;
        }
      }
      return schemaStr;
    });

    await this.sheetService.createSheet(this.config.name, [headers, schema]);
  }

  /**
   * Get all records
   */
  async findAll(): Promise<T[]> {
    return await this.sheetService.getSheetData<T>(this.config.name);
  }

  /**
   * Get record by ID
   */
  async findById(id: string): Promise<T | null> {
    const records = await this.findAll();
    return records.find(record => record.id === id) || null;
  }

  /**
   * Create new record
   */
  async create(data: Partial<T>): Promise<T> {
    const now = new Date().toISOString();
    const record = {
      ...data,
      id: data.id || this.generateId(),
      created_at: now,
      updated_at: now,
      public_read: data.public_read ?? true,
      public_write: data.public_write ?? false,
      user_read: data.user_read ?? [],
      user_write: data.user_write ?? [],
      role_read: data.role_read ?? [],
      role_write: data.role_write ?? []
    } as T;

    await this.sheetService.addRecord(this.config.name, record);
    return record;
  }

  /**
   * Update existing record
   */
  async update(id: string, data: Partial<T>): Promise<T | null> {
    const existingRecord = await this.findById(id);
    if (!existingRecord) {
      return null;
    }

    const updatedRecord = {
      ...existingRecord,
      ...data,
      id, // Ensure ID doesn't change
      updated_at: new Date().toISOString()
    } as T;

    await this.sheetService.updateRecord(this.config.name, id, updatedRecord);
    return updatedRecord;
  }

  /**
   * Delete record
   */
  async delete(id: string): Promise<boolean> {
    return await this.sheetService.deleteRecord(this.config.name, id);
  }

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}