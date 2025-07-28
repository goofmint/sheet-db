import { BaseRecord, BaseDataService, ColumnDefinition, SheetConfig } from './data';
import { SheetService } from '../services/sheet-legacy';

/**
 * Role record interface
 */
export interface RoleRecord extends BaseRecord {
  name: string;
}

/**
 * Role-specific columns (excluding default columns)
 */
const ROLE_COLUMNS: ColumnDefinition[] = [
  { name: 'name', type: 'string', required: true, unique: true }
];

/**
 * Role sheet configuration
 */
const ROLE_SHEET_CONFIG: SheetConfig = {
  name: '_Role',
  columns: ROLE_COLUMNS
};


/**
 * Role data service
 */
export class RoleService extends BaseDataService<RoleRecord> {
  private static instance: RoleService;

  private constructor() {
    super(SheetService.getInstance(), ROLE_SHEET_CONFIG);
  }

  static getInstance(): RoleService {
    if (!RoleService.instance) {
      RoleService.instance = new RoleService();
    }
    return RoleService.instance;
  }

  /**
   * Initialize sheet (structure only, no default data)
   */
  async initializeSheet(): Promise<void> {
    await super.initializeSheet();
    // Note: No default roles are created automatically
    // Users can create roles as needed through the UI
  }

  /**
   * Find role by name
   */
  async findByName(name: string): Promise<RoleRecord | null> {
    const roles = await this.findAll();
    return roles.find(role => role.name === name) || null;
  }

  /**
   * Create role with validation
   */
  async create(data: Partial<RoleRecord>): Promise<RoleRecord> {
    if (!data.name) {
      throw new Error('Role name is required');
    }

    // Check if role name already exists
    const existingRole = await this.findByName(data.name);
    if (existingRole) {
      throw new Error('Role with this name already exists');
    }

    return super.create(data);
  }

  /**
   * Update role with name validation
   */
  async update(id: string, data: Partial<RoleRecord>): Promise<RoleRecord | null> {
    if (data.name) {
      // Check if name is already used by another role
      const existingRole = await this.findByName(data.name);
      if (existingRole && existingRole.id !== id) {
        throw new Error('Role name is already used by another role');
      }
    }

    return super.update(id, data);
  }
}