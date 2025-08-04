import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import app from '@/index';
import { env } from 'cloudflare:test';
import { setupConfigDatabase } from '../utils/database-setup';

describe('Config Add Functionality', () => {
  const db = drizzle(env.DB);

  beforeAll(async () => {
    // Setup database and ConfigService
    await setupConfigDatabase(db);
    await ConfigService.initialize(db);
    
    // Add required config for testing
    await ConfigService.upsert('app.config_password', 'testPassword123', 'string');
    await ConfigService.upsert('app.setup_completed', 'true', 'boolean');
  });

  describe('Config Add UI', () => {
    it('should include add configuration button in the UI', async () => {
      const response = await app.fetch(
        new Request('http://localhost/config', {
          method: 'GET',
        }),
        env
      );

      expect(response.status).toBe(200);
      const html = await response.text();
      
      // Check for add button
      expect(html).toContain('add-config-btn');
      expect(html).toContain('Add Configuration');
      
      // Check for modal structure
      expect(html).toContain('add-config-modal');
      expect(html).toContain('Configuration Key');
      expect(html).toContain('Data Type');
      expect(html).toContain('config-value');
      expect(html).toContain('Description');
    });

    it('should have type selection options in the modal', async () => {
      const response = await app.fetch(
        new Request('http://localhost/config', {
          method: 'GET',
        }),
        env
      );

      expect(response.status).toBe(200);
      const html = await response.text();
      
      // Check for type options
      expect(html).toContain('value="string">String</option>');
      expect(html).toContain('value="boolean">Boolean</option>');
      expect(html).toContain('value="number">Number</option>');
      expect(html).toContain('value="json">JSON</option>');
    });
  });

  describe('Config Add via API', () => {
    it('should successfully add a new string configuration', async () => {
      const configData = {
        key: 'test.string.config',
        value: 'test value',
        type: 'string',
        description: 'Test string configuration'
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/configs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer testPassword123'
          },
          body: JSON.stringify(configData),
        }),
        env
      );

      expect(response.status).toBe(201);
      const result = await response.json() as { success: boolean; data: { id: string } };
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();

      // Verify the config was added
      const addedConfig = ConfigService.findByKey('test.string.config');
      expect(addedConfig).toBeDefined();
      expect(addedConfig?.value).toBe('test value');
      expect(addedConfig?.description).toBe('Test string configuration');
    });

    it('should successfully add a boolean configuration', async () => {
      const configData = {
        key: 'test.boolean.config',
        value: true,
        type: 'boolean',
        description: 'Test boolean configuration'
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/configs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer testPassword123'
          },
          body: JSON.stringify(configData),
        }),
        env
      );

      expect(response.status).toBe(201);
      const result = await response.json() as { success: boolean };
      expect(result.success).toBe(true);

      // Verify the config was added
      const addedConfig = ConfigService.findByKey('test.boolean.config');
      expect(addedConfig).toBeDefined();
      expect(addedConfig?.value).toBe('true'); // ConfigService stores as string
      expect(addedConfig?.type).toBe('boolean');
    });

    it('should successfully add a number configuration', async () => {
      const configData = {
        key: 'test.number.config',
        value: 123.45,
        type: 'number',
        description: 'Test number configuration'
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/configs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer testPassword123'
          },
          body: JSON.stringify(configData),
        }),
        env
      );

      expect(response.status).toBe(201);
      const result = await response.json() as { success: boolean };
      expect(result.success).toBe(true);

      // Verify the config was added
      const addedConfig = ConfigService.findByKey('test.number.config');
      expect(addedConfig).toBeDefined();
      expect(addedConfig?.value).toBe('123.45');
      expect(addedConfig?.type).toBe('number');
    });

    it('should successfully add a JSON configuration', async () => {
      const configData = {
        key: 'test.json.config',
        value: {"enabled": true, "limit": 100},
        type: 'json',
        description: 'Test JSON configuration'
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/configs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer testPassword123'
          },
          body: JSON.stringify(configData),
        }),
        env
      );

      expect(response.status).toBe(201);
      const result = await response.json() as { success: boolean };
      expect(result.success).toBe(true);

      // Verify the config was added
      const addedConfig = ConfigService.findByKey('test.json.config');
      expect(addedConfig).toBeDefined();
      expect(addedConfig?.value).toBe('{"enabled":true,"limit":100}'); // JSON.stringify format
      expect(addedConfig?.type).toBe('json');
    });

    it('should reject duplicate configuration keys', async () => {
      // First, add a config
      await ConfigService.upsert('test.duplicate.key', 'original value', 'string');

      const configData = {
        key: 'test.duplicate.key',
        value: 'new value',
        type: 'string',
        description: 'Duplicate key test'
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/configs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer testPassword123'
          },
          body: JSON.stringify(configData),
        }),
        env
      );

      expect(response.status).toBe(409);
      const result = await response.json() as { success: boolean; error: { code: string; message: string } };
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('DUPLICATE_KEY');
    });

    it('should require authentication for adding configs', async () => {
      const configData = {
        key: 'test.auth.config',
        value: 'test',
        type: 'string'
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/configs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(configData),
        }),
        env
      );

      expect(response.status).toBe(401);
      const result = await response.json() as { success: boolean; error: { code: string } };
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('JavaScript Functionality', () => {
    it('should include necessary JavaScript functions in client.js', async () => {
      const response = await app.fetch(
        new Request('http://localhost/statics/config/client.js', {
          method: 'GET',
        }),
        env
      );

      expect(response.status).toBe(200);
      const jsContent = await response.text();
      
      // Check for required functions
      expect(jsContent).toContain('showAddConfigModal');
      expect(jsContent).toContain('hideAddConfigModal');
      expect(jsContent).toContain('handleAddConfig');
      expect(jsContent).toContain('convertValueByType');
      expect(jsContent).toContain('showErrorInModal');
      expect(jsContent).toContain('showSuccessMessage');
      
      // Check for event listeners
      expect(jsContent).toContain('add-config-btn');
      expect(jsContent).toContain('add-config-form');
      expect(jsContent).toContain('modal-close-btn');
    });
  });

  describe('CSS Styling', () => {
    it('should include necessary CSS for modal and buttons', async () => {
      const response = await app.fetch(
        new Request('http://localhost/statics/config/style.css', {
          method: 'GET',
        }),
        env
      );

      expect(response.status).toBe(200);
      const cssContent = await response.text();
      
      // Check for required styles
      expect(cssContent).toContain('.config-actions');
      expect(cssContent).toContain('.modal');
      expect(cssContent).toContain('.modal-content');
      expect(cssContent).toContain('.modal-header');
      expect(cssContent).toContain('.modal-body');
      expect(cssContent).toContain('.btn-primary');
      expect(cssContent).toContain('.btn-secondary');
      expect(cssContent).toContain('.success-message');
      expect(cssContent).toContain('.modal-error');
    });
  });
});