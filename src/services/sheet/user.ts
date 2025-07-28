import { Env } from '@/types/env';
import { ConfigService } from '@/services/config';
import { GoogleOAuthService } from '@/services/google-oauth';
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
    // TODO: delete実装 - Google Sheets API integration needed
    console.warn(`Delete operation not implemented for sheet: ${sheetName}`);
    return {
      success: false,
      error: 'Delete operation not implemented yet'
    };
  }

  async exists(sheetName: string): Promise<boolean> {
    try {
      // Google Sheets設定の取得
      const spreadsheetId = ConfigService.getString('google.sheetId');
      if (!spreadsheetId) {
        return false;
      }

      // 自動リフレッシュ機能付きでアクセストークンを取得
      const googleOAuth = new GoogleOAuthService();
      const accessToken = await googleOAuth.getValidAccessToken();

      // シートの存在をチェック
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as { sheets: Array<{ properties: { title: string } }> };
      return data.sheets.some(sheet => sheet.properties.title === sheetName);
    } catch (error) {
      console.error(`Error checking sheet existence for ${sheetName}:`, error);
      return false;
    }
  }

  async createSheet(sheetName: string, headers: string[], acl?: SheetACL): Promise<SheetOperationResult> {
    try {
      // Google Sheets設定の取得
      const spreadsheetId = ConfigService.getString('google.sheetId');
      if (!spreadsheetId) {
        return {
          success: false,
          error: 'Google spreadsheet ID not configured'
        };
      }

      // 自動リフレッシュ機能付きでアクセストークンを取得
      const googleOAuth = new GoogleOAuthService();
      const accessToken = await googleOAuth.getValidAccessToken();

      // 新しいシートを作成
      const createSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      const createSheetResponse = await fetch(createSheetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }]
        })
      });

      if (!createSheetResponse.ok) {
        const error = await createSheetResponse.text();
        return {
          success: false,
          error: `Failed to create sheet: ${error}`
        };
      }

      // ヘッダー行とスキーマ行を追加
      const schemaRow = headers.map(header => {
        // デフォルトのスキーマ定義
        if (header === 'id') return 'string|required|unique';
        if (header === 'created_at' || header === 'updated_at') return 'timestamp|default:CURRENT_TIMESTAMP';
        if (header.startsWith('public_')) return 'boolean|default:false';
        if (header.includes('_read') || header.includes('_write')) return 'string[]|default:[]';
        return 'string';
      });

      const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}2?valueInputOption=RAW`;
      const valuesResponse = await fetch(valuesUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [headers, schemaRow]
        })
      });

      if (!valuesResponse.ok) {
        const error = await valuesResponse.text();
        return {
          success: false,
          error: `Failed to add headers: ${error}`
        };
      }

      console.log(`Sheet ${sheetName} created successfully with headers:`, headers);
      return { success: true };

    } catch (error) {
      console.error(`Error creating sheet ${sheetName}:`, error);
      return {
        success: false,
        error: `Sheet creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
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