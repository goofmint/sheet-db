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
import { requiredSheets } from '../../constants/required-sheets';

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
