import { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '../../../services/config';
import type { Env } from '../../../types';

/**
 * Get validation rules for configuration fields
 * Returns validation rules in a format suitable for frontend validation
 */
export const validationRulesHandler = async (c: Context<{ Bindings: Env }>) => {
  try {
    // Initialize ConfigService if needed
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }

    // Get all configurations with validation rules
    const configs = ConfigService.getAllWithValidation();
    const validationRules: Record<string, any> = {};

    // Extract validation rules for frontend
    for (const [key, config] of Object.entries(configs)) {
      if (config.validation) {
        validationRules[key] = config.validation;
      }
    }

    return c.json(validationRules);

  } catch (error) {
    console.error('Validation rules API error:', error);
    return c.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch validation rules'
      }
    }, 500);
  }
};