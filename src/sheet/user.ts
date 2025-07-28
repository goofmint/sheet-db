import { BaseRecord, BaseDataService, ColumnDefinition, SheetConfig } from './data';
import { UserSheetService } from '../services/sheet/user';
import { Env } from '../types/env';

/**
 * User record interface
 */
export interface UserRecord extends BaseRecord {
  email: string;
  name: string;
  picture?: string;
  last_login?: string;
}

/**
 * User-specific columns (excluding default columns)
 */
const USER_COLUMNS: ColumnDefinition[] = [
  { name: 'email', type: 'string', required: true, unique: true },
  { name: 'name', type: 'string', required: true },
  { name: 'picture', type: 'string', required: false },
  { name: 'last_login', type: 'timestamp', required: false }
];

/**
 * User sheet configuration
 */
const USER_SHEET_CONFIG: SheetConfig = {
  name: '_User',
  columns: USER_COLUMNS
};

/**
 * User sheet (domain layer)
 */
export class UserSheet {
  private userSheetService: UserSheetService;

  constructor(env: Env) {
    this.userSheetService = new UserSheetService();
  }

  /**
   * ユーザーをupsert（認証後に使用）
   */
  async upsertUser(env: Env, userData: {
    id: string;
    email: string;
    name: string;
    picture?: string;
    created_at: string;
    last_login: string;
  }) {
    const userSheetData = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture || '',
      created_at: userData.created_at,
      last_login: userData.last_login
    };
    return await this.userSheetService.upsertUser(env, userSheetData);
  }

  /**
   * ユーザーをIDで検索
   */
  async findById(env: Env, userId: string) {
    return await this.userSheetService.findUser(env, userId);
  }

  /**
   * Find user by email
   */
  async findByEmail(env: Env, email: string): Promise<UserRecord | null> {
    // この実装は現在 UserSheetService にはないため、必要に応じて後で追加
    throw new Error('findByEmail not implemented yet');
  }

  /**
   * _Userシートを初期化（必要に応じて）
   */
  async ensureUserSheet() {
    return await this.userSheetService.ensureUserSheet();
  }
}