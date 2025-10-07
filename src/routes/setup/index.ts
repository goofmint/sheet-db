/**
 * Setup API Routes
 *
 * Handles initial setup flow:
 * 1. Google OAuth2 credentials configuration
 * 2. OAuth2 authentication flow
 * 3. Sheet selection and initialization
 * 4. Final configuration (file storage, admin user, master key)
 */

import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { setupInProgressMiddleware } from '../../middleware/setup';
import { deleteGoogleTokens } from './google-tokens';
import { postGoogleConfig } from './google-config';
import { getGoogleAuth } from './google-auth';
import { getGoogleCallback } from './google-callback';
import { getSheets } from './sheets';
import { postInitializeSheetStream } from './initialize-sheet-stream';
import { postInitializeSheet } from './initialize-sheet';
import { postComplete } from './complete';

const setup = new Hono<{ Bindings: Env }>();

// DELETE /api/setup/google-tokens - Clear stored Google OAuth tokens
setup.delete('/google-tokens', deleteGoogleTokens);

// POST /api/setup/google-config - Save Google OAuth2 credentials
setup.post('/google-config', setupInProgressMiddleware, postGoogleConfig);

// GET /api/setup/google-auth - Initiate Google OAuth2 flow
setup.get('/google-auth', getGoogleAuth);

// GET /api/setup/google-callback - Handle OAuth2 callback from Google
setup.get('/google-callback', getGoogleCallback);

// GET /api/setup/sheets - Get list of available Google Sheets
setup.get('/sheets', getSheets);

// POST /api/setup/initialize-sheet-stream - Initialize sheets with SSE progress
setup.post('/initialize-sheet-stream', setupInProgressMiddleware, postInitializeSheetStream);

// POST /api/setup/initialize-sheet - Initialize sheets with JSON response
setup.post('/initialize-sheet', setupInProgressMiddleware, postInitializeSheet);

// POST /api/setup/complete - Complete initial setup with final configuration
setup.post('/complete', setupInProgressMiddleware, postComplete);

export default setup;
