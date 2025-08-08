import { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import { sheetService } from '@/services/sheet';
import { UserSheet } from '@/sheet/user';
import { RoleService } from '@/sheet/role';
import { CacheRepository } from '@/repositories/cache';
import type { Env } from '@/types';
import type { CreateSheetRequest } from './types';

/**
 * Sheet creation handler
 * Handles both general sheet creation and special system sheets (_User, _Role)
 */
export const sheetsPostHandler = async (c: Context<{ Bindings: Env }, any, {}>) => {
  try {
    const requestData = await c.req.json() as CreateSheetRequest;
    const { name, headers } = requestData;
    
    // Validate sheet name
    if (!name || typeof name !== 'string') {
      return c.json({
        error: 'bad_request',
        details: 'Sheet name is required'
      }, 400);
    }

    if (name.length < 1 || name.length > 100) {
      return c.json({
        error: 'bad_request',
        details: 'Sheet name must be between 1 and 100 characters'
      }, 400);
    }

    // Validate sheet name characters (alphanumeric, Japanese, space, hyphen, underscore)
    const validNamePattern = /^[a-zA-Z0-9\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\s\-_]+$/;
    if (!validNamePattern.test(name)) {
      return c.json({
        error: 'bad_request',
        details: 'Sheet name contains invalid characters'
      }, 400);
    }

    // Validate headers if provided
    if (headers) {
      if (!Array.isArray(headers)) {
        return c.json({
          error: 'bad_request',
          details: 'Headers must be an array of strings'
        }, 400);
      }

      if (headers.length > 50) {
        return c.json({
          error: 'bad_request',
          details: 'Maximum 50 headers allowed'
        }, 400);
      }

      for (const header of headers) {
        if (typeof header !== 'string' || header.length < 1 || header.length > 50) {
          return c.json({
            error: 'bad_request',
            details: 'Each header must be a string between 1 and 50 characters'
          }, 400);
        }
      }
    }

    // Check authentication
    const allowCreateTables = ConfigService.getBoolean('app.allow_create_tables', false);
    const masterKey = c.req.header('X-Master-Key');
    const authHeader = c.req.header('Authorization');
    
    // Check master key validation
    let isMasterKeyValid = false;
    if (masterKey) {
      const { ConfigRepository } = await import('@/repositories/config');
      const db = drizzle(c.env.DB);
      const configRepo = new ConfigRepository(db);
      isMasterKeyValid = await configRepo.verifyMasterKey(masterKey);
    }
    
    const requiresAuth = !allowCreateTables && !isMasterKeyValid;
    
    if (requiresAuth && !authHeader) {
      return c.json({
        error: 'unauthorized',
        details: 'Authentication required'
      }, 401);
    }

    // Helper function for system sheet response
    const createSystemSheetResponse = (sheetName: string) => ({
      id: sheetName,
      name: sheetName,
      url: `https://docs.google.com/spreadsheets/d/${ConfigService.getString('google.sheetId')}/edit`,
      createdAt: new Date().toISOString()
    });

    // Handle special system sheets
    if (name === '_User') {
      const userSheet = new UserSheet(c.env);
      await userSheet.ensureUserSheet();
      
      return c.json(createSystemSheetResponse('_User'), 201);
    }
    
    if (name === '_Role') {
      const roleService = RoleService.getInstance();
      await roleService.initializeSheet();
      
      return c.json(createSystemSheetResponse('_Role'), 201);
    }

    // Create general sheet
    const result = await sheetService.createSheet(
      name,
      headers || [],
      undefined // ACL can be set later
    );

    if (!result.success) {
      // Check for specific error conditions
      if (result.error?.includes('already exists')) {
        return c.json({
          error: 'conflict',
          details: result.error
        }, 409);
      }

      if (result.error?.includes('not configured')) {
        return c.json({
          error: 'service_not_configured',
          details: 'Google Sheets service is not properly configured'
        }, 500);
      }

      return c.json({
        error: 'internal_error',
        details: result.error
      }, 500);
    }

    // Cache the sheet information
    const db = drizzle(c.env.DB);
    const cacheRepo = new CacheRepository(db);
    const cacheKey = `sheet:${name}`;
    const expiresAt = new Date(Date.now() + 600 * 1000).toISOString(); // 10 minutes
    
    // Extract sheet data (result.data should be the sheet object for createSheet)
    const sheetData = Array.isArray(result.data) ? result.data[0] : result.data;
    
    await cacheRepo.upsertByKey(cacheKey, {
      cache_key: cacheKey,
      data: JSON.stringify({
        id: sheetData?.id,
        name: name,
        headers: headers || [],
        createdAt: sheetData?.createdAt
      }),
      expires_at: expiresAt,
      metadata: JSON.stringify({ type: 'sheet' })
    });

    // Return success response
    const responseData = sheetData as { id: string; name: string; url: string; createdAt: string };
    return c.json({
      id: responseData.id,
      name: responseData.name,
      url: responseData.url,
      createdAt: responseData.createdAt
    }, 201);
    
  } catch (error) {
    console.error('Sheet creation error:', error);
    return c.json({
      error: 'internal_error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 500);
  }
};