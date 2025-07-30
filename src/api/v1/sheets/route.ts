import { Hono } from 'hono';
import { sheetsPostHandler } from './post';
import type { Env } from '@/types/env';

/**
 * Sheets routes
 * Manages Google Sheets operations
 */
const sheetsRouter = new Hono<{ Bindings: Env }>();

// POST /api/v1/sheets - Create or initialize sheets
sheetsRouter.post('/', sheetsPostHandler);

// Future endpoints:
// GET /api/v1/sheets - List all sheets
// GET /api/v1/sheets/:id - Get sheet details
// PUT /api/v1/sheets/:id - Update sheet
// DELETE /api/v1/sheets/:id - Delete sheet

export default sheetsRouter;