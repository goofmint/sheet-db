import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import app from '../../src/index';
import { ConfigService } from '../../src/services/config';
import { setupTestDatabase, insertDefaultConfigData } from '../utils/database-setup';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { configTable } from '../../src/db/schema';

describe('Config Update UI Tests', () => {
  let testConfigKey: string;
  let configPassword: string;
  let drizzleDb: DrizzleD1Database;

  beforeAll(async () => {
    // Get the test database from cloudflare:test environment
    const db = env.DB;
    
    // Initialize Drizzle
    drizzleDb = drizzle(db);
    
    // Setup clean database schema
    await setupTestDatabase(drizzleDb);
    
    // Set up test config password
    configPassword = 'test-config-password-' + Date.now();
    
    // Insert minimal setup config directly to database
    await drizzleDb.insert(configTable).values({ key: 'app.setup_completed', value: 'true', type: 'boolean', system_config: 1 });
    await drizzleDb.insert(configTable).values({ key: 'app.config_password', value: configPassword, type: 'string', system_config: 1 });
    await drizzleDb.insert(configTable).values({ key: 'app.app_url', value: 'http://localhost:8787', type: 'string', system_config: 1 });
    await drizzleDb.insert(configTable).values({ key: 'auth0.domain', value: 'test.auth0.com', type: 'string', system_config: 1 });
    await drizzleDb.insert(configTable).values({ key: 'auth0.client_id', value: 'test-client-id', type: 'string', system_config: 1 });
    await drizzleDb.insert(configTable).values({ key: 'auth0.client_secret', value: 'test-client-secret', type: 'string', system_config: 1 });
    
    // Initialize ConfigService with test database
    await ConfigService.initialize(drizzleDb);
    
    // Create a test config item
    testConfigKey = 'test.update.config.' + Date.now();
    const createResponse = await app.fetch(
      new Request('http://localhost/api/v1/configs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: testConfigKey,
          value: 'initial value',
          type: 'string',
          description: 'Test config for update',
        }),
      }),
      env
    );
    expect(createResponse.status).toBe(201);
  });

  afterAll(async () => {
    if (testConfigKey) {
      // Clean up test config
      await app.fetch(
        new Request(`http://localhost/api/v1/configs/${encodeURIComponent(testConfigKey)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${configPassword}`,
          },
        }),
        env
      );
    }
  });

  it('should update an existing config with string value', async () => {
    const updateData = {
      value: 'updated value',
      type: 'string',
      description: 'Updated description',
    };

    const response = await app.fetch(
      new Request(`http://localhost/api/v1/configs/${encodeURIComponent(testConfigKey)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }),
      env
    );

    expect(response.status).toBe(200);
    const result = await response.json() as { 
      success: boolean; 
      data: { 
        key: string; 
        value: string; 
        type: string; 
        description: string;
      } 
    };
    
    expect(result.data.key).toBe(testConfigKey);
    expect(result.data.value).toBe('updated value');
    expect(result.data.description).toBe('Updated description');
    expect(result.data.type).toBe('string');
  });

  it('should update config with boolean type', async () => {
    const config = { key: 'test.bool.' + Date.now(), value: true, type: 'boolean' };
    
    // Create config
    const createResponse = await app.fetch(
      new Request('http://localhost/api/v1/configs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...config,
          description: 'Initial description',
        }),
      }),
      env
    );
    expect(createResponse.status).toBe(201);

    // Update config
    const newValue = false;
    const updateResponse = await app.fetch(
      new Request(`http://localhost/api/v1/configs/${encodeURIComponent(config.key)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: newValue,
          type: config.type,
          description: 'Updated description',
        }),
      }),
      env
    );

    expect(updateResponse.status).toBe(200);
    const result = await updateResponse.json() as { 
      success: boolean; 
      data: { 
        value: boolean; 
        description: string;
      } 
    };
    
    expect(result.data.value).toBe(false);
    expect(result.data.description).toBe('Updated description');

    // Clean up
    await app.fetch(
      new Request(`http://localhost/api/v1/configs/${encodeURIComponent(config.key)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
        },
      }),
      env
    );
  });

  it('should update config with number type', async () => {
    const config = { key: 'test.number.' + Date.now(), value: 42, type: 'number' };
    
    // Create config
    const createResponse = await app.fetch(
      new Request('http://localhost/api/v1/configs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...config,
          description: 'Initial description',
        }),
      }),
      env
    );
    expect(createResponse.status).toBe(201);

    // Update config
    const newValue = 123.45;
    const updateResponse = await app.fetch(
      new Request(`http://localhost/api/v1/configs/${encodeURIComponent(config.key)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: newValue,
          type: config.type,
          description: 'Updated description',
        }),
      }),
      env
    );

    expect(updateResponse.status).toBe(200);
    const result = await updateResponse.json() as { 
      success: boolean; 
      data: { 
        value: number; 
        description: string;
      } 
    };
    
    expect(result.data.value).toBe(123.45);
    expect(result.data.description).toBe('Updated description');

    // Clean up
    await app.fetch(
      new Request(`http://localhost/api/v1/configs/${encodeURIComponent(config.key)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
        },
      }),
      env
    );
  });

  it('should update config with json type', async () => {
    const config = { key: 'test.json.' + Date.now(), value: { foo: 'bar' }, type: 'json' };
    
    // Create config
    const createResponse = await app.fetch(
      new Request('http://localhost/api/v1/configs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...config,
          description: 'Initial description',
        }),
      }),
      env
    );
    expect(createResponse.status).toBe(201);

    // Update config
    const newValue = { updated: true, nested: { value: 'test' } };
    const updateResponse = await app.fetch(
      new Request(`http://localhost/api/v1/configs/${encodeURIComponent(config.key)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: newValue,
          type: config.type,
          description: 'Updated description',
        }),
      }),
      env
    );

    expect(updateResponse.status).toBe(200);
    const result = await updateResponse.json() as { 
      success: boolean; 
      data: { 
        value: object; 
        description: string;
      } 
    };
    
    expect(result.data.value).toEqual({ updated: true, nested: { value: 'test' } });
    expect(result.data.description).toBe('Updated description');

    // Clean up
    await app.fetch(
      new Request(`http://localhost/api/v1/configs/${encodeURIComponent(config.key)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
        },
      }),
      env
    );
  });

  it('should return 404 for non-existent config', async () => {
    const response = await app.fetch(
      new Request('http://localhost/api/v1/configs/non.existent.key', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: 'new value',
          type: 'string',
          description: 'Test',
        }),
      }),
      env
    );

    expect(response.status).toBe(404);
    const result = await response.json() as { 
      success: boolean; 
      error: { 
        message: string; 
      } 
    };
    expect(result.error.message).toContain('not found');
  });

  it('should allow empty string value for string type', async () => {
    const response = await app.fetch(
      new Request(`http://localhost/api/v1/configs/${encodeURIComponent(testConfigKey)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${configPassword}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: '',
          type: 'string',
          description: 'Test empty string',
        }),
      }),
      env
    );

    expect(response.status).toBe(200);
    const result = await response.json() as { 
      success: boolean; 
      data: { 
        value: string; 
      } 
    };
    expect(result.data.value).toBe('');
  });

  it('should require authentication', async () => {
    const response = await app.fetch(
      new Request(`http://localhost/api/v1/configs/${encodeURIComponent(testConfigKey)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: 'new value',
          description: 'Test',
        }),
      }),
      env
    );

    expect(response.status).toBe(401);
  });

  it('should reject invalid authentication', async () => {
    const response = await app.fetch(
      new Request(`http://localhost/api/v1/configs/${encodeURIComponent(testConfigKey)}`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer invalid-password',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: 'new value',
          type: 'string',
          description: 'Test',
        }),
      }),
      env
    );

    expect(response.status).toBe(401);
  });

  it('should load config page and render edit UI', async () => {
    const response = await app.fetch(
      new Request('http://localhost/config'),
      env
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    
    // Check that the page includes necessary UI elements
    expect(html).toContain('Configuration Management');
    expect(html).toContain('add-config-modal');
    expect(html).toContain('Add Configuration'); // Modal has default Add title in HTML
    expect(html).toContain('config-table');
    expect(html).toContain('Actions'); // Actions column header
  });
});