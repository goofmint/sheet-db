import { Env } from '../../types/env';
import { ConfigService } from '../config';
import { SheetCreateOptions, SheetOperationResult, SheetACL } from './types';

/**
 * シートに新しい行を作成する
 */
export async function createSheetRow(env: Env, options: SheetCreateOptions): Promise<SheetOperationResult> {
  try {
    // Google Sheets設定の取得
    const spreadsheetId = ConfigService.getString('google.sheetId');
    const accessToken = ConfigService.getString('google.access_token');

    if (!spreadsheetId) {
      return {
        success: false,
        error: 'Google Sheet ID not configured'
      };
    }

    if (!accessToken) {
      return {
        success: false,
        error: 'Google access token not available'
      };
    }

    // シートが存在するかチェック
    const sheetExists = await checkSheetExists(spreadsheetId, accessToken, options.sheetName);
    
    if (!sheetExists) {
      return {
        success: false,
        error: `Sheet ${options.sheetName} does not exist`
      };
    }

    // ヘッダーを取得
    const headers = await getSheetHeaders(spreadsheetId, accessToken, options.sheetName);
    
    if (headers.length === 0) {
      return {
        success: false,
        error: `Sheet ${options.sheetName} has no headers`
      };
    }

    // データを行の形式に変換
    const rowValues = headers.map(header => {
      const value = options.data[header];
      if (Array.isArray(value)) {
        return value.join(',');
      } else if (typeof value === 'boolean') {
        return value.toString();
      } else {
        return value?.toString() || '';
      }
    });

    // ACL情報を追加（存在する場合）
    if (options.acl) {
      const aclData = serializeACL(options.acl);
      // ACLカラムがヘッダーに存在する場合のみ追加
      Object.keys(aclData).forEach(aclKey => {
        const index = headers.indexOf(aclKey);
        if (index !== -1) {
          rowValues[index] = aclData[aclKey];
        }
      });
    }

    // 行を追加
    const escapedSheetName = escapeSheetName(options.sheetName);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${escapedSheetName}:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [rowValues]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Failed to add record to ${options.sheetName}: ${errorText}`
      };
    }

    const responseData = await response.json() as { updates?: { updatedRange?: string } };
    const updatedRange = responseData.updates?.updatedRange;
    let rowIndex: number | undefined;
    
    if (updatedRange) {
      // Range format: "SheetName!A3:F3" -> extract row number
      const match = updatedRange.match(/:([A-Z]+)(\d+)$/);
      if (match) {
        rowIndex = parseInt(match[2], 10);
      }
    }

    return {
      success: true,
      data: options.data,
      rowIndex
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'  
    };
  }
}

/**
 * シートが存在するかチェック
 */
async function checkSheetExists(spreadsheetId: string, accessToken: string, sheetName: string): Promise<boolean> {
  try {
    const escapedSheetName = escapeSheetName(sheetName);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${escapedSheetName}!A1:A1`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * シートのヘッダーを取得
 */
async function getSheetHeaders(spreadsheetId: string, accessToken: string, sheetName: string): Promise<string[]> {
  const escapedSheetName = escapeSheetName(sheetName);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${escapedSheetName}!1:1`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get headers for ${sheetName}`);
  }

  const data = await response.json() as { values?: string[][] };
  return data.values?.[0] || [];
}

/**
 * ACL情報をシリアライズ
 */
function serializeACL(acl: SheetACL): Record<string, string> {
  return {
    public_read: acl.public_read.toString(),
    public_write: acl.public_write.toString(),
    read_users: acl.read_users.join(','),
    write_users: acl.write_users.join(',')
  };
}

/**
 * シート名をエスケープ（A1記法用）
 */
function escapeSheetName(sheetName: string): string {
  // 英数字とアンダースコアのみなら不要
  const safeCharactersOnly = /^[a-zA-Z0-9_]+$/.test(sheetName);
  
  if (safeCharactersOnly) {
    return sheetName;
  }
  
  // 内部のシングルクォートをエスケープ
  const escapedName = sheetName.replace(/'/g, "''");
  
  // 全体をシングルクォートで囲む
  return `'${escapedName}'`;
}