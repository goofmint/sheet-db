import { createSheetRow } from './create';
import { findSheetRows, findSheetRow } from './find';
import { updateSheetRow } from './update';
import { 
  ISheetService, 
  SheetCreateOptions, 
  SheetFindOptions, 
  SheetUpdateOptions, 
  SheetOperationResult,
  SheetACL
} from './types';

/**
 * Google Sheetsサービスの実装
 */
export class SheetService implements ISheetService {
  
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

// デフォルトインスタンスをエクスポート
export const sheetService = new SheetService();

// 型とヘルパー関数もエクスポート
export * from './types';
export { UserSheetService } from './user';