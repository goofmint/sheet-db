import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Config API Tests', () => {
  const BASE_URL = 'http://localhost:8787';
  const AUTH_TOKEN = process.env.TOKEN || 'test-token';
  
  // Helper function to make API requests
  async function apiRequest(path: string, options: RequestInit = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return { response, data };
  }

  describe('POST /api/v1/configs', () => {
    const testConfigs: Array<{
      key: string;
      value: any;
      type: string;
      description: string;
    }> = [];

    afterAll(async () => {
      // Cleanup test configs
      for (const config of testConfigs) {
        try {
          await apiRequest(`/api/v1/configs/${encodeURIComponent(config.key)}`, {
            method: 'DELETE'
          });
        } catch (error) {
          console.warn(`Failed to cleanup config ${config.key}:`, error);
        }
      }
    });

    it('should create string configuration', async () => {
      const testConfig = {
        key: `test.string.${Date.now()}`,
        value: 'test string value',
        type: 'string',
        description: 'Test string configuration'
      };
      testConfigs.push(testConfig);

      const { response, data } = await apiRequest('/api/v1/configs', {
        method: 'POST',
        body: JSON.stringify(testConfig)
      });

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.key).toBe(testConfig.key);
      expect(data.data.value).toBe(testConfig.value);
      expect(data.data.type).toBe(testConfig.type);
    });

    it('should create boolean configuration with boolean value', async () => {
      const testConfig = {
        key: `test.boolean.${Date.now()}`,
        value: true,
        type: 'boolean',
        description: 'Test boolean configuration'
      };
      testConfigs.push(testConfig);

      const { response, data } = await apiRequest('/api/v1/configs', {
        method: 'POST',
        body: JSON.stringify(testConfig)
      });

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.key).toBe(testConfig.key);
      expect(data.data.value).toBe(true);
      expect(data.data.type).toBe(testConfig.type);
    });

    it('should create boolean configuration with string value', async () => {
      const testConfig = {
        key: `test.boolean.string.${Date.now()}`,
        value: 'true',
        type: 'boolean',
        description: 'Test boolean configuration with string value'
      };
      testConfigs.push(testConfig);

      const { response, data } = await apiRequest('/api/v1/configs', {
        method: 'POST',
        body: JSON.stringify(testConfig)
      });

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.key).toBe(testConfig.key);
      expect(data.data.value).toBe(true); // Should be converted to boolean
      expect(data.data.type).toBe(testConfig.type);
    });

    it('should create number configuration', async () => {
      const testConfig = {
        key: `test.number.${Date.now()}`,
        value: 42,
        type: 'number',
        description: 'Test number configuration'
      };
      testConfigs.push(testConfig);

      const { response, data } = await apiRequest('/api/v1/configs', {
        method: 'POST',
        body: JSON.stringify(testConfig)
      });

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.key).toBe(testConfig.key);
      expect(data.data.value).toBe(testConfig.value);
      expect(data.data.type).toBe(testConfig.type);
    });

    it('should create JSON configuration', async () => {
      const jsonValue = { test: true, items: [1, 2, 3] };
      const testConfig = {
        key: `test.json.${Date.now()}`,
        value: jsonValue,
        type: 'json',
        description: 'Test JSON configuration'
      };
      testConfigs.push(testConfig);

      const { response, data } = await apiRequest('/api/v1/configs', {
        method: 'POST',
        body: JSON.stringify(testConfig)
      });

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.key).toBe(testConfig.key);
      expect(data.data.value).toEqual(jsonValue);
      expect(data.data.type).toBe(testConfig.type);
    });

    it('should reject invalid boolean values', async () => {
      const testConfig = {
        key: `test.invalid.boolean.${Date.now()}`,
        value: 'invalid',
        type: 'boolean',
        description: 'Test invalid boolean'
      };

      const { response, data } = await apiRequest('/api/v1/configs', {
        method: 'POST',
        body: JSON.stringify(testConfig)
      });

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/v1/configs/:key', () => {
    let testConfigKey: string;

    beforeAll(async () => {
      // Create a test config for updates
      testConfigKey = `test.update.${Date.now()}`;
      await apiRequest('/api/v1/configs', {
        method: 'POST',
        body: JSON.stringify({
          key: testConfigKey,
          value: false,
          type: 'boolean',
          description: 'Test configuration for updates'
        })
      });
    });

    afterAll(async () => {
      // Cleanup test config
      try {
        await apiRequest(`/api/v1/configs/${encodeURIComponent(testConfigKey)}`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.warn(`Failed to cleanup config ${testConfigKey}:`, error);
      }
    });

    it('should update boolean configuration from false to true', async () => {
      const updateData = {
        value: true,
        type: 'boolean',
        description: 'Updated boolean configuration'
      };

      const { response, data } = await apiRequest(`/api/v1/configs/${encodeURIComponent(testConfigKey)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.value).toBe(true);
      expect(data.data.type).toBe('boolean');
    });

    it('should update boolean configuration from true to false', async () => {
      const updateData = {
        value: false,
        type: 'boolean',
        description: 'Updated boolean configuration'
      };

      const { response, data } = await apiRequest(`/api/v1/configs/${encodeURIComponent(testConfigKey)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.value).toBe(false);
      expect(data.data.type).toBe('boolean');
    });

    it('should update boolean configuration with string "true"', async () => {
      const updateData = {
        value: 'true',
        type: 'boolean',
        description: 'Updated boolean configuration with string'
      };

      const { response, data } = await apiRequest(`/api/v1/configs/${encodeURIComponent(testConfigKey)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.value).toBe(true);
      expect(data.data.type).toBe('boolean');
    });

    it('should update boolean configuration with string "false"', async () => {
      const updateData = {
        value: 'false',
        type: 'boolean',
        description: 'Updated boolean configuration with string'
      };

      const { response, data } = await apiRequest(`/api/v1/configs/${encodeURIComponent(testConfigKey)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.value).toBe(false);
      expect(data.data.type).toBe('boolean');
    });

    it('should reject invalid boolean string values', async () => {
      const updateData = {
        value: 'invalid',
        type: 'boolean',
        description: 'Invalid boolean update'
      };

      const { response, data } = await apiRequest(`/api/v1/configs/${encodeURIComponent(testConfigKey)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent config', async () => {
      const updateData = {
        value: true,
        type: 'boolean',
        description: 'Update non-existent config'
      };

      const { response, data } = await apiRequest('/api/v1/configs/non.existent.key', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });
});