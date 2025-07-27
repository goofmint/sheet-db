import { BaseRecord, BaseDataService, ColumnDefinition, SheetConfig } from './data';
import { SheetService } from '../services/sheet';

/**
 * User record interface
 */
export interface UserRecord extends BaseRecord {
  email: string;
  name: string;
}

/**
 * User-specific columns (excluding default columns)
 */
const USER_COLUMNS: ColumnDefinition[] = [
  { name: 'email', type: 'string', required: true, unique: true },
  { name: 'name', type: 'string', required: true }
];

/**
 * User sheet configuration
 */
const USER_SHEET_CONFIG: SheetConfig = {
  name: '_User',
  columns: USER_COLUMNS
};

/**
 * User data service
 */
export class UserService extends BaseDataService<UserRecord> {
  private static instance: UserService;

  private constructor() {
    super(SheetService.getInstance(), USER_SHEET_CONFIG);
  }

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserRecord | null> {
    const users = await this.findAll();
    return users.find(user => user.email === email) || null;
  }

  /**
   * Create user with validation
   */
  async create(data: Partial<UserRecord>): Promise<UserRecord> {
    if (!data.email) {
      throw new Error('Email is required');
    }
    if (!data.name) {
      throw new Error('Name is required');
    }

    // Check if email already exists
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    return super.create(data);
  }

  /**
   * Update user with email validation
   */
  async update(id: string, data: Partial<UserRecord>): Promise<UserRecord | null> {
    if (data.email) {
      // Check if email is already used by another user
      const existingUser = await this.findByEmail(data.email);
      if (existingUser && existingUser.id !== id) {
        throw new Error('Email is already used by another user');
      }
    }

    return super.update(id, data);
  }
}