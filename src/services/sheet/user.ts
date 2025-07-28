import { Env } from '@/types/env';
import { createSheetRow } from './create';
import { findSheetRows } from './find';
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
 * SheetServiceの実装（UserSheetServiceで使用）
 */
class LocalSheetService implements ISheetService {
  async create(options: SheetCreateOptions): Promise<SheetOperationResult> {
    return createSheetRow(options);
  }

  async find(options: SheetFindOptions): Promise<SheetOperationResult> {
    return findSheetRows(options);
  }

  async update(options: SheetUpdateOptions): Promise<SheetOperationResult> {
    return updateSheetRow(options);
  }

  async delete(sheetName: string, filter: { column: string; value: string | number | boolean }): Promise<SheetOperationResult> {
    // TODO: delete実装
    return {
      success: false,
      error: 'Delete operation not implemented yet'
    };
  }

  async exists(sheetName: string): Promise<boolean> {
    // TODO: exists実装
    return false;
  }

  async createSheet(sheetName: string, headers: string[], acl?: SheetACL): Promise<SheetOperationResult> {
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
  private sheetService = new LocalSheetService();

  /**
   * ユーザーデータをupsert（作成または更新）
   */
  async upsertUser(env: Env, userData: Omit<UserSheetData, '_rowIndex'>): Promise<SheetOperationResult> {
    const { id } = userData;
    
    // 既存ユーザーを検索
    const findResult = await this.sheetService.find({
      sheetName: '_User',
      filter: {
        column: 'id',
        value: id
      }
    });

    if (!findResult.success) {
      return findResult;
    }

    const existingUsers = Array.isArray(findResult.data) ? findResult.data : [];
    
    if (existingUsers.length > 0) {
      // 既存ユーザーを更新（Auth0から取得した最新情報で更新）
      return this.sheetService.update({
        sheetName: '_User',
        filter: {
          column: 'id',
          value: id
        },
        data: {
          email: userData.email,
          name: userData.name,
          picture: userData.picture,
          last_login: userData.last_login
        }
      });
    } else {
      // 新規ユーザーを作成
      const userACL = createUserACL(id);
      
      return this.sheetService.create({
        sheetName: '_User',
        data: userData,
        acl: userACL
      });
    }
  }

  /**
   * ユーザーを検索
   */
  async findUser(env: Env, userId: string): Promise<SheetOperationResult> {
    return this.sheetService.find({
      sheetName: '_User',
      filter: {
        column: 'id',
        value: userId
      },
      limit: 1
    });
  }

  /**
   * _Userシートを初期化（必要に応じて）
   */
  async ensureUserSheet(): Promise<SheetOperationResult> {
    // TODO: _Userシートが存在しない場合は作成
    const exists = await this.sheetService.exists('_User');
    
    if (!exists) {
      return this.sheetService.createSheet('_User', USER_SHEET_HEADERS);
    }

    return { success: true };
  }
}