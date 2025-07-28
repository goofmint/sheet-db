import { Env } from '../../types/env';
import { ConfigService } from '../config';
import { SheetUpdateOptions, SheetOperationResult, SheetRow } from './types';
import { findSheetRows } from './find';

/**
 * シートの行を更新する
 */
export async function updateSheetRow(env: Env, options: SheetUpdateOptions): Promise<SheetOperationResult> {
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

    // 更新対象の行を検索
    const findResult = await findSheetRows(env, {
      sheetName: options.sheetName,
      filter: options.filter,
      limit: 1
    });

    if (!findResult.success) {
      return findResult;
    }

    if (!Array.isArray(findResult.data) || findResult.data.length === 0) {
      return {
        success: false,
        error: `No matching row found for filter: ${options.filter.column}=${options.filter.value}`
      };
    }

    // 対象行のインデックスを取得するため、再度生データを取得
    const rowIndex = await findRowIndex(spreadsheetId, accessToken, options.sheetName, options.filter);
    
    if (rowIndex === -1) {
      return {
        success: false,
        error: `Target row not found for update`
      };
    }

    // シートのヘッダーを取得
    const headers = await getSheetHeaders(spreadsheetId, accessToken, options.sheetName);
    
    if (headers.length === 0) {
      return {
        success: false,
        error: `Sheet ${options.sheetName} has no headers`
      };
    }

    // 現在の行データを取得
    const currentRow = findResult.data[0];
    
    // 更新データをマージ
    const updatedData = { ...currentRow, ...options.data };

    // データを行の形式に変換
    const rowValues = headers.map(header => {
      const value = updatedData[header];
      if (Array.isArray(value)) {
        return value.join(',');
      } else if (typeof value === 'boolean') {
        return value.toString();
      } else {
        return value?.toString() || '';
      }
    });

    // 行を更新
    const escapedSheetName = escapeSheetName(options.sheetName);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${escapedSheetName}!A${rowIndex}?valueInputOption=RAW`, {
      method: 'PUT',
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
        error: `Failed to update record in ${options.sheetName}: ${errorText}`
      };
    }

    return {
      success: true,
      data: updatedData as SheetRow,
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
 * フィルタ条件に基づいて行インデックスを検索
 */
async function findRowIndex(
  spreadsheetId: string, 
  accessToken: string, 
  sheetName: string, 
  filter: { column: string; value: string | number | boolean }
): Promise<number> {
  const escapedSheetName = escapeSheetName(sheetName);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${escapedSheetName}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return -1;
  }

  const data = await response.json() as { values?: string[][] };
  const values = data.values || [];
  
  if (values.length < 3) {
    return -1;
  }

  const headers = values[0];
  const columnIndex = headers.indexOf(filter.column);
  
  if (columnIndex === -1) {
    return -1;
  }

  // データ行から検索（ヘッダー+スキーマをスキップ）
  for (let i = 2; i < values.length; i++) {
    const cellValue = values[i][columnIndex];
    
    // 値の型に応じて比較
    let matches = false;
    if (typeof filter.value === 'boolean') {
      matches = cellValue?.toLowerCase() === filter.value.toString();
    } else {
      matches = cellValue === filter.value.toString();
    }
    
    if (matches) {
      return i + 1; // Google Sheetsは1ベースインデックス
    }
  }

  return -1;
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