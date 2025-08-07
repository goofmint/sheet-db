import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '@/index';
import { ConfigService } from '@/services/config';
import { setupConfigDatabase, setupSessionDatabase } from '../../../utils/database-setup';
import { drizzle } from 'drizzle-orm/d1';
import { SessionRepository } from '@/repositories/session';
import { createTestSession } from '../../../utils/auth-utils';
import { SheetService } from '@/services/sheet-legacy';

interface SheetInfo {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    default?: any;
    min?: number;
    max?: number;
    required?: boolean;
    pattern?: string;
  }>;
}

interface SheetsListResponse {
  success: true;
  data: {
    sheets: SheetInfo[];
    total: number;
    accessible_count: number;
    system_sheet_count?: number;
  };
  meta: {
    user_id?: string;
    is_master_key_auth: boolean;
    include_system: boolean;
    filter_applied?: string;
  };
}

interface SheetsErrorResponse {
  success: false;
  error: string;
  message: string;
}

type SheetsApiResponse = SheetsListResponse | SheetsErrorResponse;

describe('GET /api/v1/sheets', () => {
  const db = drizzle(env.DB);
  const sessionRepo = new SessionRepository(db);

  beforeEach(async () => {
    // Setup database and ConfigService
    await setupConfigDatabase(db);
    await setupSessionDatabase(db);
    await ConfigService.initialize(db);
    
    // Create test session for authentication
    await createTestSession(sessionRepo);

    // Mock SheetService methods
    vi.clearAllMocks();
  });

  describe('with mock data', () => {
    beforeEach(async () => {
      // Mock SheetService instance and methods
      const mockSheetService = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getSpreadsheetMetadata: vi.fn().mockResolvedValue({
          sheets: [
            {
              properties: {
                title: 'users',
                sheetId: 1,
                gridProperties: { rowCount: 10, columnCount: 5 }
              }
            },
            {
              properties: {
                title: 'products', 
                sheetId: 2,
                gridProperties: { rowCount: 20, columnCount: 8 }
              }
            },
            {
              properties: {
                title: '_ACL',
                sheetId: 3,
                gridProperties: { rowCount: 5, columnCount: 10 }
              }
            }
          ]
        }),
        getSheetValues: vi.fn().mockImplementation((sheetName: string) => {
          if (sheetName === 'users') {
            return Promise.resolve({
              values: [
                ['id', 'name', 'email', 'created_at'],
                ['string', 'string', 'string', 'timestamp']
              ]
            });
          } else if (sheetName === 'products') {
            return Promise.resolve({
              values: [
                ['id', 'title', 'price', 'category'],
                ['string', 'string', 'number', 'string']
              ]
            });
          } else if (sheetName === '_ACL') {
            return Promise.resolve({
              values: [
                ['sheet_name', 'public_read', 'public_write'],
                ['string', 'boolean', 'boolean']
              ]
            });
          }
          return Promise.resolve({ values: [] });
        })
      };

      vi.spyOn(SheetService, 'getInstance').mockReturnValue(mockSheetService as any);
    });

    it('should return list of accessible sheets without authentication', async () => {
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(200);

      const data = await response.json() as SheetsApiResponse;
      expect(data.success).toBe(true);

      if (data.success) {
        expect(data.data.sheets).toHaveLength(2); // Only non-system sheets
        expect(data.data.sheets.map(s => s.name)).toEqual(['users', 'products']);
        expect(data.data.total).toBe(3); // Including system sheet in total count
        expect(data.data.accessible_count).toBe(2);
        expect(data.meta.is_master_key_auth).toBe(false);
        expect(data.meta.include_system).toBe(false);
      }
    });

    it('should return system sheets with master key', async () => {
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-master-key': 'test-master-key'
        }
      });
      const testEnv = { ...env, MASTER_KEY: 'test-master-key' };
      const response = await app.fetch(request, testEnv);

      expect(response.status).toBe(200);

      const data = await response.json() as SheetsApiResponse;
      expect(data.success).toBe(true);

      if (data.success) {
        expect(data.data.sheets).toHaveLength(3); // Including system sheets
        expect(data.data.sheets.map(s => s.name)).toEqual(['users', 'products', '_ACL']);
        expect(data.data.system_sheet_count).toBe(1);
        expect(data.meta.is_master_key_auth).toBe(true);
        expect(data.meta.include_system).toBe(true);
      }
    });

    it('should filter sheets by name', async () => {
      const request = new Request('http://localhost/api/v1/sheets?filter=user', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(200);

      const data = await response.json() as SheetsApiResponse;
      expect(data.success).toBe(true);

      if (data.success) {
        expect(data.data.sheets).toHaveLength(1);
        expect(data.data.sheets[0].name).toBe('users');
        expect(data.meta.filter_applied).toBe('user');
      }
    });

    it('should include column information', async () => {
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(200);

      const data = await response.json() as SheetsApiResponse;
      expect(data.success).toBe(true);

      if (data.success) {
        const usersSheet = data.data.sheets.find(s => s.name === 'users');
        expect(usersSheet).toBeDefined();
        expect(usersSheet?.columns).toHaveLength(4);
        expect(usersSheet?.columns[0]).toEqual({
          name: 'id',
          type: 'string'
        });
        expect(usersSheet?.columns[3]).toEqual({
          name: 'created_at',
          type: 'timestamp'
        });
      }
    });

    it('should handle sheets with no data', async () => {
      // Mock a sheet that returns empty data
      const mockSheetService = SheetService.getInstance() as any;
      mockSheetService.getSheetValues.mockImplementation((sheetName: string) => {
        if (sheetName === 'empty_sheet') {
          return Promise.resolve({ values: [] });
        }
        // Return original implementation for other sheets
        return mockSheetService.getSheetValues.getMockImplementation()(sheetName);
      });

      mockSheetService.getSpreadsheetMetadata.mockResolvedValue({
        sheets: [
          {
            properties: {
              title: 'empty_sheet',
              sheetId: 4,
              gridProperties: { rowCount: 0, columnCount: 0 }
            }
          }
        ]
      });

      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(200);

      const data = await response.json() as SheetsApiResponse;
      expect(data.success).toBe(true);

      if (data.success) {
        expect(data.data.sheets).toHaveLength(1);
        expect(data.data.sheets[0].name).toBe('empty_sheet');
        expect(data.data.sheets[0].columns).toEqual([]);
      }
    });

    it('should handle Google Sheets API errors gracefully', async () => {
      // Mock SheetService to throw error
      const mockSheetService = SheetService.getInstance() as any;
      mockSheetService.getSpreadsheetMetadata.mockRejectedValue(new Error('Google Sheets API error'));

      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(500);

      const data = await response.json() as SheetsApiResponse;
      expect(data.success).toBe(false);

      if (!data.success) {
        expect((data as SheetsErrorResponse).error).toBe('sheets_fetch_failed');
        expect((data as SheetsErrorResponse).message).toBe('Failed to retrieve sheet information');
      }
    });

    it('should handle individual sheet read errors', async () => {
      const mockSheetService = SheetService.getInstance() as any;
      
      // Mock getSheetValues to fail for one specific sheet
      mockSheetService.getSheetValues.mockImplementation((sheetName: string) => {
        if (sheetName === 'problematic_sheet') {
          throw new Error('Sheet read error');
        }
        if (sheetName === 'good_sheet') {
          return Promise.resolve({
            values: [
              ['id', 'name'],
              ['string', 'string']
            ]
          });
        }
        return Promise.resolve({ values: [] });
      });

      mockSheetService.getSpreadsheetMetadata.mockResolvedValue({
        sheets: [
          {
            properties: {
              title: 'good_sheet',
              sheetId: 1
            }
          },
          {
            properties: {
              title: 'problematic_sheet',
              sheetId: 2
            }
          }
        ]
      });

      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(200);

      const data = await response.json() as SheetsApiResponse;
      expect(data.success).toBe(true);

      if (data.success) {
        expect(data.data.sheets).toHaveLength(2);
        
        // Good sheet should have proper columns
        const goodSheet = data.data.sheets.find(s => s.name === 'good_sheet');
        expect(goodSheet?.columns).toHaveLength(2);

        // Problematic sheet should still be included but with empty columns
        const problematicSheet = data.data.sheets.find(s => s.name === 'problematic_sheet');
        expect(problematicSheet?.columns).toEqual([]);
      }
    });
  });

  describe('master key validation', () => {
    beforeEach(async () => {
      // Set up environment with master key
      const mockSheetService = {
        initialize: vi.fn().mockResolvedValue(undefined),
        getSpreadsheetMetadata: vi.fn().mockResolvedValue({
          sheets: [
            {
              properties: {
                title: '_SystemSheet',
                sheetId: 1
              }
            }
          ]
        }),
        getSheetValues: vi.fn().mockResolvedValue({
          values: [
            ['id', 'config'],
            ['string', 'string']
          ]
        })
      };

      vi.spyOn(SheetService, 'getInstance').mockReturnValue(mockSheetService as any);
    });

    it('should deny access to system sheets without master key', async () => {
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(200);

      const data = await response.json() as SheetsApiResponse;
      expect(data.success).toBe(true);

      if (data.success) {
        expect(data.data.sheets).toHaveLength(0); // System sheet should be filtered out
        expect(data.meta.include_system).toBe(false);
      }
    });

    it('should validate master key format', async () => {
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-master-key': 'invalid-key'
        }
      });
      const testEnv = { ...env, MASTER_KEY: 'test-master-key' };
      const response = await app.fetch(request, testEnv);

      expect(response.status).toBe(200);

      const data = await response.json() as SheetsApiResponse;
      expect(data.success).toBe(true);

      if (data.success) {
        expect(data.data.sheets).toHaveLength(0); // System sheet should still be filtered
        expect(data.meta.is_master_key_auth).toBe(false);
      }
    });
  });
});