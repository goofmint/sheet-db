import { Env } from '../../types/env';
import { createSheetRow } from './create';
import { findSheetRows, findSheetRow } from './find';
import { updateSheetRow } from './update';
import { 
  ISheetService, 
  SheetCreateOptions, 
  SheetFindOptions, 
  SheetUpdateOptions, 
  SheetOperationResult,
  SheetACL,
  UserSheetData,
  createUserACL,
  USER_SHEET_HEADERS
} from './types';

/**
 * Google Sheetsサービスの実装
 */
export class SheetService implements ISheetService {
  
  async create(env: Env, options: SheetCreateOptions): Promise<SheetOperationResult> {
    return await createSheetRow(env, options);
  }

  async find(env: Env, options: SheetFindOptions): Promise<SheetOperationResult> {
    return await findSheetRows(env, options);
  }

  async update(env: Env, options: SheetUpdateOptions): Promise<SheetOperationResult> {
    return await updateSheetRow(env, options);
  }

  async delete(env: Env, sheetName: string, filter: { column: string; value: string | number | boolean }): Promise<SheetOperationResult> {
    // TODO: delete実装
    return {
      success: false,
      error: 'Delete operation not implemented yet'
    };
  }

  async exists(env: Env, sheetName: string): Promise<boolean> {
    // TODO: exists実装
    return false;
  }

  async createSheet(env: Env, sheetName: string, headers: string[], acl?: SheetACL): Promise<SheetOperationResult> {
    // TODO: createSheet実装
    return {
      success: false,
      error: 'CreateSheet operation not implemented yet'
    };
  }
}

/**
 * ユーザー管理用のヘルパー関数
 */
export class UserSheetService {
  private sheetService = new SheetService();

  /**
   * ユーザーデータをupsert（作成または更新）
   */
  async upsertUser(env: Env, userData: Omit<UserSheetData, '_rowIndex'>): Promise<SheetOperationResult> {
    const { auth0_id } = userData;
    
    // 既存ユーザーを検索
    const findResult = await this.sheetService.find(env, {
      sheetName: '_User',
      filter: {
        column: 'auth0_id',
        value: auth0_id
      }
    });

    if (!findResult.success) {
      return findResult;
    }

    const existingUsers = Array.isArray(findResult.data) ? findResult.data : [];
    
    if (existingUsers.length > 0) {
      // 既存ユーザーを更新（last_loginのみ）
      return await this.sheetService.update(env, {
        sheetName: '_User',
        filter: {
          column: 'auth0_id',
          value: auth0_id
        },
        data: {
          last_login: userData.last_login
        }
      });
    } else {
      // 新規ユーザーを作成
      const userACL = createUserACL(auth0_id);
      
      return await this.sheetService.create(env, {
        sheetName: '_User',
        data: userData,
        acl: userACL
      });
    }
  }

  /**
   * ユーザーを検索
   */
  async findUser(env: Env, auth0Id: string): Promise<SheetOperationResult> {
    return await this.sheetService.find(env, {
      sheetName: '_User',
      filter: {
        column: 'auth0_id',
        value: auth0Id
      },
      limit: 1
    });
  }

  /**
   * _Userシートを初期化（必要に応じて）
   */
  async ensureUserSheet(env: Env): Promise<SheetOperationResult> {
    // TODO: _Userシートが存在しない場合は作成
    const exists = await this.sheetService.exists(env, '_User');
    
    if (!exists) {
      return await this.sheetService.createSheet(env, '_User', USER_SHEET_HEADERS);
    }

    return { success: true };
  }
}

// デフォルトインスタンスをエクスポート
export const sheetService = new SheetService();
export const userSheetService = new UserSheetService();

// 型とヘルパー関数もエクスポート
export * from './types';
export { UserSheetService };