import { Env } from '@/types/env';
import { ConfigService } from '@/services/config';
import { SheetFindOptions, SheetOperationResult, SheetRow } from './types';

/**
 * シートから行を検索する
 */
export async function findSheetRows(env: Env, options: SheetFindOptions): Promise<SheetOperationResult> {
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

    // シートのデータを取得
    const escapedSheetName = escapeSheetName(options.sheetName);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${escapedSheetName}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: true,
          data: []
        };
      }
      const errorText = await response.text();
      return {
        success: false,
        error: `Failed to get sheet data ${options.sheetName}: ${errorText}`
      };
    }

    const data = await response.json() as { values?: string[][] };
    const values = data.values || [];

    if (values.length < 3) {
      // ヘッダー + スキーマ + データが必要
      return {
        success: true,
        data: []
      };
    }

    const headers = values[0];
    const dataRows = values.slice(2); // ヘッダーとスキーマ行をスキップ

    // データを解析してオブジェクト配列に変換
    let parsedRows = dataRows.map((row: string[], index: number) => {
      const record: SheetRow = {};
      headers.forEach((header: string, columnIndex: number) => {
        const value = row[columnIndex] || '';
        
        // 型に基づいて値を解析
        if (header.includes('_at') && value) {
          record[header] = value; // 日時は文字列のまま
        } else if (header.includes('public_') && value) {
          record[header] = value.toLowerCase() === 'true';
        } else if (header.endsWith('_users') && value) {
          // 配列フィールドの解析
          record[header] = value.split(',').map((s: string) => s.trim()).filter(Boolean).join(',');
        } else {
          record[header] = value;
        }
      });
      
      // 内部的に行インデックスを保持（1ベース、ヘッダー+スキーマを考慮）
      record._rowIndex = index + 3;
      
      return record;
    });

    // フィルタ適用
    if (options.filter) {
      const { column, value } = options.filter;
      parsedRows = parsedRows.filter(row => {
        const rowValue = row[column];
        return rowValue === value;
      });
    }

    // 制限適用
    if (options.limit && options.limit > 0) {
      parsedRows = parsedRows.slice(0, options.limit);
    }

    // 内部フィールドを削除
    const cleanedRows = parsedRows.map(row => {
      const { _rowIndex, ...cleanRow } = row;
      return cleanRow;
    });

    return {
      success: true,
      data: cleanedRows
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * 単一行を検索（最初にマッチしたもの）
 */
export async function findSheetRow(env: Env, options: SheetFindOptions): Promise<SheetOperationResult> {
  const result = await findSheetRows(env, { ...options, limit: 1 });
  
  if (result.success && Array.isArray(result.data) && result.data.length > 0) {
    return {
      success: true,
      data: result.data[0]
    };
  } else if (result.success) {
    return {
      success: true,
      data: undefined
    };
  }
  
  return result;
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