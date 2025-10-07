/**
 * POST /api/setup/initialize-sheet-stream
 *
 * Initialize required sheets (_Users, _Roles, _Files) with Server-Sent Events progress
 */

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { ConfigRepository } from '../../db/config.repository';
import { GoogleSheetsService } from '../../services/google-sheets.service';

export async function postInitializeSheetStream(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json<{ sheetId: string; sheetName: string }>();

    if (!body.sheetId || !body.sheetName) {
      return c.json({ error: 'Missing sheetId or sheetName' }, 400);
    }

    const configRepo = new ConfigRepository(c.env);
    const accessToken = await configRepo.getGoogleAccessToken();

    if (!accessToken) {
      return c.json(
        { error: 'No access token available. Please authenticate first.' },
        401
      );
    }

    // Save sheet configuration
    await configRepo.saveSheetConfig(body.sheetId, body.sheetName);

    // Create Server-Sent Events stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const sheetsService = new GoogleSheetsService(accessToken);

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

          const createdSheets: string[] = [];
          const errors: string[] = [];

          // Create each sheet sequentially (one-by-one to avoid Workers execution time limit)
          for (const sheet of requiredSheets) {
            try {
              send('progress', { message: `Checking ${sheet.title}...`, sheet: sheet.title, status: 'checking' });

              const exists = await sheetsService.sheetExists(body.sheetId, sheet.title);

              if (!exists) {
                send('progress', { message: `Creating ${sheet.title}...`, sheet: sheet.title, status: 'creating' });

                await sheetsService.createSheetWithHeaders(
                  body.sheetId,
                  sheet.title,
                  sheet.headers,
                  sheet.columnDefs
                );

                createdSheets.push(sheet.title);
                send('progress', { message: `✓ ${sheet.title} created successfully`, sheet: sheet.title, status: 'created' });
              } else {
                send('progress', { message: `✓ ${sheet.title} already exists`, sheet: sheet.title, status: 'exists' });
              }
            } catch (error) {
              const errorMsg = `Failed to create ${sheet.title}: ${
                error instanceof Error ? error.message : String(error)
              }`;
              errors.push(errorMsg);
              send('error', { message: errorMsg, sheet: sheet.title });
            }
          }

          // Send completion event
          send('complete', {
            success: errors.length === 0,
            createdSheets,
            errors
          });

          controller.close();
        } catch (error) {
          send('error', {
            message: error instanceof Error ? error.message : String(error)
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in initialize-sheet-stream:', error);
    return c.json(
      {
        error: 'Failed to start initialization',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}
