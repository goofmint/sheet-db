/**
 * GET /api/setup/sheets
 *
 * Get list of available Google Sheets
 */

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { ConfigRepository } from '../../db/config.repository';
import { GoogleSheetsService } from '../../services/google-sheets.service';

export async function getSheets(c: Context<{ Bindings: Env }>) {
  try {
    const configRepo = new ConfigRepository(c.env);
    const accessToken = await configRepo.getGoogleAccessToken();

    if (!accessToken) {
      return c.json(
        { error: 'No access token available. Please authenticate first.' },
        401
      );
    }

    const sheetsService = new GoogleSheetsService(accessToken);
    const sheets = await sheetsService.listSpreadsheets();

    return c.json({ sheets });
  } catch (error) {
    console.error('Error listing sheets:', error);
    return c.json(
      {
        error: 'Failed to list spreadsheets',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}
