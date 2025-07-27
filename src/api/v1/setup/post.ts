import { Context } from 'hono';
import { ConfigService } from '../../../services/config';
import type { Env } from '../../../types';
import type { SetupSuccessResponse } from './types';
import type { ConfigType } from '../../../db/schema';
import { validateSetupRequest } from './validators';

/**
 * Setup POST API endpoint - processes setup configuration
 * 
 * Security model:
 * - Setup incomplete: Free access for initial setup
 * - Setup complete: Require authentication for re-setup
 */
export const setupPostHandler = async (c: Context<{ Bindings: Env }>) => {
  try {
    // Check current setup status
    const isSetupCompleted = ConfigService.getBoolean('app.setup_completed', false);
    
    // Authentication check (only required if setup already completed)
    if (isSetupCompleted) {
      const authHeader = c.req.header('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      const storedPassword = ConfigService.getString('app.config_password');
      
      // Defensive check: if storedPassword is undefined, treat as authentication failure
      if (!storedPassword) {
        return c.json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication configuration is missing'
          }
        }, 401);
      }
      
      const isAuthenticated = !!(token && token === storedPassword);
      
      if (!isAuthenticated) {
        return c.json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authorization header with Bearer token required for setup modification'
          }
        }, 401);
      }
    }

    // Parse request body
    let requestData: unknown;
    try {
      requestData = await c.req.json();
    } catch (error) {
      return c.json({
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body'
        }
      }, 400);
    }

    // Validate request data
    const validation = validateSetupRequest(requestData);
    if (!validation.isValid) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: validation.errors
        }
      }, 400);
    }

    const setupData = validation.data!;

    // Handle sheetId-only request (during sheet selection) - now with authentication
    if (setupData.sheetId && !setupData.google) {
      await ConfigService.upsert('google.sheetId', setupData.sheetId, 'string', 'Selected Google Sheet ID');
      
      return c.json({
        success: true,
        message: 'Sheet selected successfully',
        timestamp: new Date().toISOString()
      });
    }

    // Build configuration object
    const configs: Record<string, { value: string; type?: ConfigType }> = {};
    
    // Add configurations only if provided
    if (setupData.google) {
      configs['google.client_id'] = { value: setupData.google.clientId };
      configs['google.client_secret'] = { value: setupData.google.clientSecret };
    }
    
    if (setupData.auth0) {
      configs['auth0.domain'] = { value: setupData.auth0.domain };
      configs['auth0.client_id'] = { value: setupData.auth0.clientId };
      configs['auth0.client_secret'] = { value: setupData.auth0.clientSecret };
    }
    
    if (setupData.app) {
      configs['app.config_password'] = { value: setupData.app.configPassword };
    }

    // Add storage configuration if provided
    if (setupData.storage) {
      configs['storage.type'] = { value: setupData.storage.type };
      
      if (setupData.storage.type === 'r2' && setupData.storage.r2) {
        configs['storage.r2.bucket'] = { value: setupData.storage.r2.bucket };
        configs['storage.r2.accessKeyId'] = { value: setupData.storage.r2.accessKeyId };
        configs['storage.r2.secretAccessKey'] = { value: setupData.storage.r2.secretAccessKey };
        configs['storage.r2.endpoint'] = { value: setupData.storage.r2.endpoint };
      } else if (setupData.storage.type === 'gdrive' && setupData.storage.gdrive) {
        configs['storage.gdrive.folderId'] = { value: setupData.storage.gdrive.folderId };
      }
    }

    // Add selected sheet ID if provided
    if (setupData.sheetId) {
      configs['google.sheetId'] = { value: setupData.sheetId };
    }

    // Set setup completion flag
    // Initial setup: complete after basic config is saved
    // Full setup: complete only when storage and sheetId are provided
    // Re-setup: always mark as completed
    if (!setupData.storage && !setupData.sheetId) {
      // Initial setup - basic configuration completed
      configs['app.setup_completed'] = { value: 'true', type: 'boolean' };
    } else if (setupData.storage && setupData.sheetId) {
      // Full setup with storage and sheet - all setup completed
      configs['app.setup_completed'] = { value: 'true', type: 'boolean' };
    } else if (isSetupCompleted) {
      // Re-setup scenario - keep completed status
      configs['app.setup_completed'] = { value: 'true', type: 'boolean' };
    }

    // Save all configurations
    try {
      await ConfigService.setAll(configs);
    } catch (error) {
      // If any update fails, attempt to rollback by refreshing cache from database
      try {
        await ConfigService.refreshCache();
      } catch (rollbackError) {
        console.error('Failed to rollback configuration cache:', rollbackError);
      }
      
      // Re-throw the original error
      throw error;
    }

    // Determine configured services
    const configuredServices: string[] = [];
    if (setupData.google || ConfigService.getString('google.client_id')) {
      configuredServices.push('google');
    }
    if (setupData.auth0 || ConfigService.getString('auth0.domain')) {
      configuredServices.push('auth0');
    }

    // Build success response
    const response: SetupSuccessResponse = {
      success: true,
      message: isSetupCompleted 
        ? 'Setup configuration updated successfully'
        : 'Initial setup completed successfully',
      setup: {
        isCompleted: true,
        completedAt: new Date().toISOString(),
        configuredServices
      },
      timestamp: new Date().toISOString()
    };

    return c.json(response);

  } catch (error) {
    console.error('Setup POST API error:', error);
    return c.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process setup configuration'
      }
    }, 500);
  }
};