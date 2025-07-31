import { Context } from 'hono';
import { ConfigService } from '../../../services/config';
import type { Env } from '../../../types';
import type { SetupSuccessResponse } from './types';
import type { ConfigType } from '../../../db/schema';
import { validateSetupRequest } from './validators';
import { constantTimeEquals } from '../../../utils/security';
import { ConfigValidator } from '../../../utils/config-validator';

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
      
      const isAuthenticated = !!(token && constantTimeEquals(token, storedPassword || ''));
      
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

    // Check if this is flat config data (key/value pairs from config form)
    if (requestData && typeof requestData === 'object') {
      const data = requestData as Record<string, any>;
      const hasDotNotation = Object.keys(data).some(key => key.includes('.'));
      
      if (hasDotNotation) {
        // This is flat config data - process directly as key/value pairs
        const configs: Record<string, { value: string; type?: ConfigType }> = {};
        
        for (const [key, value] of Object.entries(data)) {
          if (key === 'csrf_token') continue;
          
          // Get existing config to preserve the original type
          const existingType = ConfigService.getType(key) as ConfigType;
          
          // Convert boolean values to string for storage
          let stringValue: string;
          if (typeof value === 'boolean') {
            stringValue = value ? 'true' : 'false';
          } else {
            stringValue = String(value);
          }
          
          const configType: ConfigType = existingType || (typeof value === 'boolean' ? 'boolean' : 'string');
          configs[key] = { 
            value: stringValue,
            type: configType
          };
        }
        
        // Validate configurations before saving
        const configToValidate = Object.entries(configs).reduce((acc, [key, config]) => {
          acc[key] = config.value;
          return acc;
        }, {} as Record<string, string>);

        const validationResult = await ConfigValidator.validateAll(configToValidate);
        if (!validationResult.valid) {
          return c.json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Configuration validation failed',
              details: validationResult.errors
            }
          }, 400);
        }

        // Save all configurations
        try {
          await ConfigService.setAll(configs);
        } catch (error) {
          try {
            await ConfigService.refreshCache();
          } catch (rollbackError) {
            console.error('Failed to rollback configuration cache:', rollbackError);
          }
          throw error;
        }
        
        // Return success response
        return c.json({
          success: true,
          message: 'Configuration updated successfully',
          timestamp: new Date().toISOString()
        }, 200);
      }
    }

    // Legacy validation for nested structure (keep for backward compatibility)
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
      }, 200);
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

    // Validate configurations before saving
    const configToValidateNested = Object.entries(configs).reduce((acc, [key, config]) => {
      acc[key] = config.value;
      return acc;
    }, {} as Record<string, string>);

    const validationResultNested = await ConfigValidator.validateAll(configToValidateNested);
    if (!validationResultNested.valid) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Configuration validation failed',
          details: validationResultNested.errors
        }
      }, 400);
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

    return c.json(response, 200);

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

/**
 * Transform flat config data (dot notation) to nested structure
 */
function transformFlatConfigData(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {
    google: {},
    auth0: {},
    app: {}
  };

  // Copy CSRF token
  if (data.csrf_token) {
    result.csrf_token = data.csrf_token;
  }

  // First pass: determine storage type
  let storageType = 'r2'; // default
  for (const [key, value] of Object.entries(data)) {
    if (key === 'storage.type') {
      storageType = value;
      break;
    }
  }

  // Initialize storage object based on type
  if (storageType === 'gdrive') {
    result.storage = { type: 'gdrive', gdrive: {} };
  } else {
    result.storage = { type: 'r2', r2: {} };
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === 'csrf_token') continue;
    
    const parts = key.split('.');
    if (parts.length === 2) {
      const [section, field] = parts;
      if (section === 'google') {
        result.google[field === 'client_id' ? 'clientId' : field === 'client_secret' ? 'clientSecret' : field] = value;
      } else if (section === 'auth0') {
        result.auth0[field === 'client_id' ? 'clientId' : field === 'client_secret' ? 'clientSecret' : field] = value;
      } else if (section === 'app') {
        if (field === 'config_password') {
          result.app.configPassword = value;
        } else if (field === 'setup_completed') {
          result.app.setupCompleted = value === 'true' || value === true;
        }
      } else if (section === 'storage' && field === 'type') {
        result.storage.type = value;
      }
    } else if (parts.length === 3 && parts[0] === 'storage') {
      const [, subSection, field] = parts;
      if (subSection === 'r2' && result.storage.r2) {
        result.storage.r2[field] = value;
      } else if (subSection === 'gdrive' && result.storage.gdrive) {
        result.storage.gdrive[field] = value;
      }
    }
  }

  // Remove empty sections
  if (Object.keys(result.google).length === 0) delete result.google;
  if (Object.keys(result.auth0).length === 0) delete result.auth0;
  if (Object.keys(result.app).length === 0) delete result.app;
  
  // Remove storage if no specific storage config provided
  const hasStorageConfig = 
    (result.storage.r2 && Object.keys(result.storage.r2).length > 0) ||
    (result.storage.gdrive && Object.keys(result.storage.gdrive).length > 0);
  
  if (!hasStorageConfig) {
    delete result.storage;
  }

  return result;
}