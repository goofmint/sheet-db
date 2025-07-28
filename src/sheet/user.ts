import { BaseRecord, BaseDataService, ColumnDefinition, SheetConfig } from './data';
import { SheetService } from '../services/legacy-sheet';

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
   * Find all users by email (for duplicate detection)
   */
  async findAllByEmail(email: string): Promise<UserRecord[]> {
    const users = await this.findAll();
    return users.filter(user => user.email === email);
  }

  /**
   * Create user with validation and race condition protection
   */
  async create(data: Partial<UserRecord>): Promise<UserRecord> {
    if (!data.email) {
      throw new Error('Email is required');
    }
    if (!data.name) {
      throw new Error('Name is required');
    }

    try {
      // The base class will handle unique constraint validation atomically
      return await super.create(data);
    } catch (error: any) {
      // If it's a unique constraint violation for email, provide user-friendly message
      if (error.status === 409 && error.field === 'email') {
        throw new Error('User with this email already exists');
      }
      
      // Re-throw original error
      throw error;
    }
  }

  /**
   * Update user with email validation
   */
  async update(id: string, data: Partial<UserRecord>): Promise<UserRecord | null> {
    try {
      // The base class will handle unique constraint validation atomically
      return await super.update(id, data);
    } catch (error: any) {
      // If it's a unique constraint violation for email, provide user-friendly message
      if (error.status === 409 && error.field === 'email') {
        throw new Error('Email is already used by another user');
      }
      
      // Re-throw original error
      throw error;
    }
  }
}