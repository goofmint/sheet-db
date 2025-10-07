/**
 * Initial setup page route
 *
 * Serves multi-step setup wizard for Google Sheets connection and configuration
 */

import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { Layout } from '../../components/Layout';
import { Setup } from '../../components/Setup';
import { ConfigRepository } from '../../db/config.repository';
import { GoogleSheetsService } from '../../services/google-sheets.service';

const setup = new Hono<{ Bindings: Env }>();

/**
 * GET /setup - Initial setup wizard
 *
 * Query parameters:
 * - step: Current step number (1, 2, 2.5, 3)
 * - code: OAuth authorization code (from Google callback)
 * - state: OAuth state token (from Google callback)
 * - error: Error message to display
 */
setup.get('/', async (c) => {
  const environment = c.env.ENVIRONMENT || 'development';
  const step = Number(c.req.query('step')) || 1;
  const error = c.req.query('error');

  // Check if setup is already completed
  const configRepo = new ConfigRepository(c.env);
  const isSetupCompleted = await configRepo.isSetupComplete();

  if (isSetupCompleted) {
    return c.json(
      { error: 'Setup already completed. Please go to the dashboard.' },
      403
    );
  }

  // Debug: Check if we need to re-authenticate due to scope change
  const hasTokens = !!(await configRepo.getGoogleAccessToken());
  console.log('[Setup] Has tokens:', hasTokens, 'Step:', step);

  let sheets: Array<{ id: string; name: string; url: string }> | undefined;
  let initProgress: { users: boolean; roles: boolean; files: boolean } | undefined;

  // Step 2: Load available sheets
  if (step === 2) {
    try {
      const configRepo = new ConfigRepository(c.env);
      const accessToken = await configRepo.getGoogleAccessToken();

      console.log('[Setup Step 2] Access token exists:', !!accessToken);

      if (!accessToken) {
        return c.redirect('/setup?step=1&error=' + encodeURIComponent('Not authenticated'));
      }

      const sheetsService = new GoogleSheetsService(accessToken);
      console.log('[Setup Step 2] Fetching spreadsheets...');
      const spreadsheets = await sheetsService.listSpreadsheets();
      console.log('[Setup Step 2] Found spreadsheets:', spreadsheets.length);

      sheets = spreadsheets.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
      }));
    } catch (err) {
      console.error('[Setup Step 2] Error:', err);
      return c.redirect(
        '/setup?step=1&error=' +
          encodeURIComponent('Failed to load sheets: ' + (err instanceof Error ? err.message : String(err)))
      );
    }
  }

  // Step 2.5: Check initialization progress
  if (step === 2.5) {
    // For now, simulate completed initialization
    // In a real implementation, this would check actual sheet structure
    initProgress = {
      users: true,
      roles: true,
      files: true,
    };
  }

  return c.html(
    <Layout title="Initial Setup - Sheet DB Admin" environment={environment} currentPath="/setup">
      <Setup step={step} error={error} sheets={sheets} initProgress={initProgress} />
    </Layout>
  );
});

export default setup;
