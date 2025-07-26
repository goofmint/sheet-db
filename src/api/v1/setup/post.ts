import { Context } from 'hono';
import { ConfigService } from '../../../services/config';
import type { Env } from '../../../types';
import type { SetupRequest, SetupSuccessResponse } from './types';
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

    // Save configuration to database
    const configUpdates = [
      // Google OAuth settings
      { key: 'google.client_id', value: setupData.google.clientId, description: 'Google OAuth Client ID' },
      { key: 'google.client_secret', value: setupData.google.clientSecret, description: 'Google OAuth Client Secret' },
      
      // Auth0 settings
      { key: 'auth0.domain', value: setupData.auth0.domain, description: 'Auth0 Domain' },
      { key: 'auth0.client_id', value: setupData.auth0.clientId, description: 'Auth0 Client ID' },
      { key: 'auth0.client_secret', value: setupData.auth0.clientSecret, description: 'Auth0 Client Secret' },
      
      // App settings
      { key: 'app.config_password', value: setupData.app.configPassword, description: 'Configuration Password' },
      
      // Setup completion flag
      { key: 'app.setup_completed', value: 'true', type: 'boolean' as const, description: 'Setup completion status' }
    ];

    // Add database URL if provided
    if (setupData.database?.url) {
      configUpdates.push({
        key: 'database.url',
        value: setupData.database.url,
        description: 'Database URL'
      });
    }

    // Save all configurations
    for (const config of configUpdates) {
      await ConfigService.upsert(
        config.key,
        config.value,
        config.type || 'string',
        config.description
      );
    }

    // Determine configured services
    const configuredServices = ['google', 'auth0'];
    if (setupData.database?.url) {
      configuredServices.push('database');
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