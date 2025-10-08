/**
 * POST /api/setup/complete
 *
 * Complete initial setup with final configuration
 */

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { ConfigRepository } from '../../db/config.repository';
import { GoogleSheetsService } from '../../services/google-sheets.service';
import type { CompleteSetupRequest } from '../../types/google';
import { hashPassword } from '../../utils/password';

export async function postComplete(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json<CompleteSetupRequest>();

    // Validate input
    if (!body.sheetId) {
      return c.json({ error: 'Missing sheetId' }, 400);
    }

    if (!body.fileStorage || !body.fileStorage.type) {
      return c.json({ error: 'Missing file storage configuration' }, 400);
    }

    if (!body.adminUser || !body.adminUser.userId || !body.adminUser.password) {
      return c.json({ error: 'Missing admin user configuration' }, 400);
    }

    if (!body.masterKey) {
      return c.json({ error: 'Missing master key' }, 400);
    }

    const configRepo = new ConfigRepository(c.env);

    // Double-check setup is not already completed to prevent re-running
    const isAlreadyCompleted = await configRepo.isSetupComplete();
    if (isAlreadyCompleted) {
      return c.json(
        { error: 'Setup is already completed. Cannot re-run setup.' },
        409
      );
    }

    // 1. Save sheet configuration
    await configRepo.saveSheetConfig(body.sheetId);

    // 2. Save file storage configuration
    await configRepo.saveFileStorageConfig(body.fileStorage);

    // 3. Save master key
    await configRepo.saveMasterKey(body.masterKey);

    // 4. Create initial admin user in _Users sheet
    const accessToken = await configRepo.getGoogleAccessToken();
    if (!accessToken) {
      return c.json(
        { error: 'No access token available. Please authenticate first.' },
        401
      );
    }

    const sheetsService = new GoogleSheetsService(accessToken);

    // Hash password using PBKDF2 with salt
    const passwordHash = await hashPassword(body.adminUser.password);

    // Generate user ID
    const userId = crypto.randomUUID();

    // Task 2.2: Create Administrator role if it doesn't exist
    // Check if Administrator role exists in _Roles sheet
    const rolesData = await sheetsService.getSheetData(body.sheetId, '_Roles');
    const adminRole = rolesData.find((row) => row.name === 'Administrator');

    // Create Administrator role if it doesn't exist
    if (!adminRole) {
      const administratorRoleId = crypto.randomUUID();
      await sheetsService.appendRow(body.sheetId, '_Roles', [
        administratorRoleId,
        'Administrator',
        'System administrator with full access',
        `["${userId}"]`,
        new Date().toISOString(),
      ]);
      console.log('[Setup] Created Administrator role');

      // Add admin user to _Users sheet
      await sheetsService.appendRow(body.sheetId, '_Users', [
        userId,
        body.adminUser.userId,
        passwordHash,
        '',
        'Administrator',
        'active',
        new Date().toISOString(),
      ]);
      console.log('[Setup] Created initial admin user with Administrator role');

      // Mark setup as completed
      await configRepo.markSetupCompleted();
      return c.json({ success: true });
    }

    // Administrator role exists - add user to it
    const administratorRoleId = adminRole.object_id as string;
    const existingUsersRaw = adminRole.users as string | undefined;
    const existingUsers = existingUsersRaw ? JSON.parse(existingUsersRaw) : [];

    // Add new user if not already present
    if (!existingUsers.includes(userId)) {
      existingUsers.push(userId);
      await sheetsService.updateRow(body.sheetId, '_Roles', administratorRoleId, {
        users: JSON.stringify(existingUsers),
      });
      console.log('[Setup] Added user to existing Administrator role');
    }

    // Add admin user to _Users sheet (using correct column structure)
    await sheetsService.appendRow(body.sheetId, '_Users', [
      userId, // object_id
      body.adminUser.userId, // username
      passwordHash, // _password_hash (salt:hash format)
      '', // email (empty for now)
      'Administrator', // name
      'active', // status
      new Date().toISOString(), // created_at
    ]);

    console.log('[Setup] Created initial admin user with Administrator role');

    // 5. Mark setup as completed
    await configRepo.markSetupCompleted();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error completing setup:', error);
    return c.json(
      {
        error: 'Failed to complete setup',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
}
