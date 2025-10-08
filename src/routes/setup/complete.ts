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
    const administratorExists = rolesData.some(
      (row: Array<string | number | boolean>) => row[1] === 'Administrator' // Check 'name' column
    );

    let administratorRoleId: string;
    if (!administratorExists) {
      // Create Administrator role
      administratorRoleId = crypto.randomUUID();
      await sheetsService.appendRow(body.sheetId, '_Roles', [
        administratorRoleId, // object_id
        'Administrator', // name
        'System administrator with full access', // description
        `["${userId}"]`, // users array with initial admin user
        new Date().toISOString(), // created_at
      ]);
      console.log('[Setup] Created Administrator role');
    } else {
      // Get existing Administrator role and add user to it
      const adminRole = rolesData.find(
        (row: Array<string | number | boolean>) => row[1] === 'Administrator'
      );
      if (adminRole) {
        administratorRoleId = adminRole[0] as string;

        // Parse existing users array
        const existingUsers = adminRole[3]
          ? JSON.parse(adminRole[3] as string)
          : [];

        // Add new user if not already present
        if (!existingUsers.includes(userId)) {
          existingUsers.push(userId);

          // Update the role's users column
          await sheetsService.updateRow(
            body.sheetId,
            '_Roles',
            administratorRoleId,
            [
              administratorRoleId,
              adminRole[1], // name
              adminRole[2], // description
              JSON.stringify(existingUsers), // updated users array
              adminRole[4], // created_at
            ]
          );
          console.log('[Setup] Added user to existing Administrator role');
        }
      } else {
        throw new Error('Administrator role not found despite existence check');
      }
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
