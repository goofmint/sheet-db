/**
 * POST /api/setup/initialize-sheet
 *
 * Initialize required sheets (_Users, _Roles, _Files) with headers
 */

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { ConfigRepository } from '../../db/config.repository';
import { GoogleSheetsService } from '../../services/google-sheets.service';
import type { SheetInitResult } from '../../types/google';

export async function postInitializeSheet(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json<{ sheetId: string }>();

    if (!body.sheetId) {
      return c.json({ error: 'Missing sheetId' }, 400);
    }

    const configRepo = new ConfigRepository(c.env);
    const accessToken = await configRepo.getGoogleAccessToken();

    if (!accessToken) {
      return c.json(
        { error: 'No access token available. Please authenticate first.' },
        401
      );
    }

    const sheetsService = new GoogleSheetsService(accessToken);
    const result: SheetInitResult = {
      success: true,
      createdSheets: [],
      errors: [],
    };

    // Define required sheets with their headers and column definitions (per design.md)
    const requiredSheets = [
      {
        title: '_Users',
        headers: [
          'object_id',
          'username',
          '_password_hash',
          'email',
          'name',
          'status',
          'created_at',
        ],
        columnDefs: [
          { type: 'string', unique: true },
          { type: 'string', unique: true, required: true },
          { type: 'string', required: true },
          { type: 'email', unique: true },
          { type: 'string' },
          { type: 'string' },
          { type: 'date' },
        ],
      },
      {
        title: '_Roles',
        headers: ['object_id', 'name', 'users', 'created_at'],
        columnDefs: [
          { type: 'string', unique: true },
          { type: 'string', unique: true, required: true },
          { type: 'array' },
          { type: 'date' },
        ],
      },
      {
        title: '_Files',
        headers: [
          'object_id',
          'original_name',
          'storage_provider',
          'storage_path',
          'content_type',
          'size_bytes',
          'owner_id',
          'public_read',
          'public_write',
          'users_read',
          'users_write',
          'roles_read',
          'roles_write',
          'created_at',
        ],
        columnDefs: [
          { type: 'string', unique: true },
          { type: 'string', required: true },
          { type: 'string', pattern: '^(r2|google_drive)$' },
          { type: 'string' },
          { type: 'string' },
          { type: 'number', min: 0 },
          { type: 'string' },
          { type: 'boolean' },
          { type: 'boolean' },
          { type: 'array' },
          { type: 'array' },
          { type: 'array' },
          { type: 'array' },
          { type: 'date' },
        ],
      },
    ];

    // Create each sheet sequentially (one-by-one to avoid Workers execution time limit)
    for (const sheet of requiredSheets) {
      try {
        console.log(`[Initialize Sheet] Checking ${sheet.title}...`);
        const exists = await sheetsService.sheetExists(body.sheetId, sheet.title);
        if (!exists) {
          console.log(`[Initialize Sheet] Creating ${sheet.title}...`);
          await sheetsService.createSheetWithHeaders(
            body.sheetId,
            sheet.title,
            sheet.headers,
            sheet.columnDefs
          );
          console.log(`[Initialize Sheet] ✓ ${sheet.title} created successfully`);
          result.createdSheets.push(sheet.title);
        } else {
          console.log(`[Initialize Sheet] ✓ ${sheet.title} already exists`);
        }
      } catch (error) {
        const errorMsg = `Failed to create ${sheet.title}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        console.error(`[Initialize Sheet] ✗ ${errorMsg}`);
        result.errors.push(errorMsg);
        result.success = false;
      }
    }

    return c.json(result);
  } catch (error) {
    console.error('Error initializing sheets:', error);
    return c.json(
      {
        success: false,
        createdSheets: [],
        errors: [error instanceof Error ? error.message : String(error)],
      },
      500
    );
  }
}
