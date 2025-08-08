import { test, expect } from '@playwright/test';

test.describe('Sheet Creation UI', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the playground page where sheet operations can be performed
    await page.goto('/playground');
  });

  test('should display sheet creation form', async ({ page }) => {
    // Check if the sheet creation section exists
    const createSheetSection = page.locator('section').filter({ hasText: 'Create Sheet' });
    await expect(createSheetSection).toBeVisible();
    
    // Check for input fields
    await expect(page.locator('input[placeholder*="Sheet name"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Headers"]')).toBeVisible();
    await expect(page.locator('button:has-text("Create Sheet")')).toBeVisible();
  });

  test('should validate sheet name is required', async ({ page }) => {
    // Click create without entering sheet name
    await page.locator('button:has-text("Create Sheet")').click();
    
    // Check for error message
    await expect(page.locator('text=/Sheet name is required/i')).toBeVisible();
  });

  test('should validate sheet name length', async ({ page }) => {
    // Enter a very long sheet name
    const longName = 'a'.repeat(101);
    await page.fill('input[placeholder*="Sheet name"]', longName);
    await page.locator('button:has-text("Create Sheet")').click();
    
    // Check for error message
    await expect(page.locator('text=/must be between 1 and 100 characters/i')).toBeVisible();
  });

  test('should validate sheet name characters', async ({ page }) => {
    // Enter invalid characters
    await page.fill('input[placeholder*="Sheet name"]', 'Invalid@Name!');
    await page.locator('button:has-text("Create Sheet")').click();
    
    // Check for error message
    await expect(page.locator('text=/invalid characters/i')).toBeVisible();
  });

  test('should allow Japanese characters in sheet name', async ({ page }) => {
    // Enter Japanese name
    await page.fill('input[placeholder*="Sheet name"]', 'テストシート_123');
    
    // Should not show validation error immediately
    await page.locator('button:has-text("Create Sheet")').click();
    
    // Should not show character validation error
    await expect(page.locator('text=/invalid characters/i')).not.toBeVisible();
  });

  test('should validate headers format', async ({ page }) => {
    await page.fill('input[placeholder*="Sheet name"]', 'TestSheet');
    
    // Enter headers as comma-separated values
    await page.fill('input[placeholder*="Headers"]', 'id, name, email, created_at');
    await page.locator('button:has-text("Create Sheet")').click();
    
    // Should attempt to create (will fail due to API not being available in test)
    // But should pass validation
    await expect(page.locator('text=/invalid characters/i')).not.toBeVisible();
    await expect(page.locator('text=/Sheet name is required/i')).not.toBeVisible();
  });

  test('should show success message on successful creation', async ({ page }) => {
    // Mock successful API response
    await page.route('/api/v1/sheets', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'sheet_123',
          name: 'TestSheet',
          url: 'https://docs.google.com/spreadsheets/d/abc123/edit#gid=0',
          createdAt: new Date().toISOString()
        })
      });
    });
    
    // Fill form and submit
    await page.fill('input[placeholder*="Sheet name"]', 'TestSheet');
    await page.fill('input[placeholder*="Headers"]', 'id, name, email');
    await page.locator('button:has-text("Create Sheet")').click();
    
    // Check for success message
    await expect(page.locator('text=/Sheet created successfully/i')).toBeVisible();
  });

  test('should show error message on API failure', async ({ page }) => {
    // Mock API error response
    await page.route('/api/v1/sheets', async route => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'conflict',
          details: 'Sheet TestSheet already exists'
        })
      });
    });
    
    // Fill form and submit
    await page.fill('input[placeholder*="Sheet name"]', 'TestSheet');
    await page.locator('button:has-text("Create Sheet")').click();
    
    // Check for error message
    await expect(page.locator('text=/already exists/i')).toBeVisible();
  });

  test('should disable form during submission', async ({ page }) => {
    // Mock slow API response
    let resolveResponse: () => void;
    const responsePromise = new Promise<void>(resolve => {
      resolveResponse = resolve;
    });
    
    await page.route('/api/v1/sheets', async route => {
      await responsePromise;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'sheet_123',
          name: 'TestSheet',
          url: 'https://docs.google.com/spreadsheets/d/abc123/edit#gid=0',
          createdAt: new Date().toISOString()
        })
      });
    });
    
    // Fill form and submit
    await page.fill('input[placeholder*="Sheet name"]', 'TestSheet');
    const createButton = page.locator('button:has-text("Create Sheet")');
    await createButton.click();
    
    // Check button is disabled during submission
    await expect(createButton).toBeDisabled();
    
    // Resolve the response
    resolveResponse!();
    
    // Wait for button to be enabled again
    await expect(createButton).toBeEnabled();
  });

  test('should clear form after successful creation', async ({ page }) => {
    // Mock successful API response
    await page.route('/api/v1/sheets', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'sheet_123',
          name: 'TestSheet',
          url: 'https://docs.google.com/spreadsheets/d/abc123/edit#gid=0',
          createdAt: new Date().toISOString()
        })
      });
    });
    
    // Fill form
    const nameInput = page.locator('input[placeholder*="Sheet name"]');
    const headersInput = page.locator('input[placeholder*="Headers"]');
    
    await nameInput.fill('TestSheet');
    await headersInput.fill('id, name, email');
    
    // Submit
    await page.locator('button:has-text("Create Sheet")').click();
    
    // Wait for success message
    await expect(page.locator('text=/Sheet created successfully/i')).toBeVisible();
    
    // Check that form is cleared
    await expect(nameInput).toHaveValue('');
    await expect(headersInput).toHaveValue('');
  });
});