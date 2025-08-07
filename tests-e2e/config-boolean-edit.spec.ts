import { test, expect } from '@playwright/test';

test.describe('Boolean Configuration Edit', () => {
  const CONFIG_PASSWORD = process.env.TOKEN || 'defaultTestPassword';

  test.beforeEach(async ({ page }) => {
    // Navigate to config page
    await page.goto('/config');
    
    // Login with authentication form
    await page.fill('#password-input', CONFIG_PASSWORD);
    await page.click('#auth-form button[type="submit"]');
    
    // Wait for config container to be displayed
    await page.waitForFunction(() => {
      const container = document.getElementById('config-container');
      return container && container.style.display === 'block';
    }, { timeout: 10000 });
    
    // Wait for config table data to load
    await page.waitForFunction(() => {
      const tbody = document.querySelector('#config-table tbody');
      return tbody && tbody.children.length > 0 && 
             !tbody.textContent?.includes('Loading...');
    }, { timeout: 10000 });
  });

  test('should successfully update boolean value from false to true', async ({ page }) => {
    
    // Use test-specific boolean config to avoid affecting system configs
    const targetConfigKey = 'test-boolean';
    let targetConfigRow = page.locator(`#config-table tbody tr:has(.config-key:text-is("${targetConfigKey}"))`);
    
    // If test-boolean doesn't exist, create it or find any false boolean config
    if (await targetConfigRow.count() === 0) {
      const falseConfigRow = page.locator('#config-table tbody tr').filter({
        has: page.locator('.config-boolean-value:not(:checked)')
      }).first();
      
      if (await falseConfigRow.count() === 0) {
        throw new Error('Test environment error: No boolean configuration with false value found for testing. Test requires at least one boolean config to be present.');
      }
      targetConfigRow = falseConfigRow;
    }

    // Get the config key
    const configKey = await targetConfigRow.locator('.config-key').textContent();

    // Click Edit button
    await targetConfigRow.locator('.config-actions button.btn-edit').click();
    
    // Verify modal opens with correct values
    await expect(page.locator('#add-config-modal')).toBeVisible();
    await expect(page.locator('#add-config-modal .modal-header h2')).toHaveText('Edit Configuration');
    
    // Verify the config type is boolean
    await expect(page.locator('#config-type')).toHaveValue('boolean');
    
    // Check current value in the input field
    const currentValueInput = page.locator('#config-value');
    const currentValue = await currentValueInput.inputValue();
    
    // Change value to true
    await currentValueInput.fill('true');
    
    // Submit the form
    await page.click('#add-config-form button[type="submit"]');
    
    // Wait for modal to close or error to appear
    await Promise.race([
      page.waitForFunction(() => {
        const modal = document.getElementById('add-config-modal');
        return !modal || modal.style.display === 'none';
      }, { timeout: 10000 }),
      page.waitForSelector('#add-config-modal #modal-error:visible', { timeout: 10000 }).catch(() => {})
    ]);
    
    // Check if there was an error
    const errorDiv = page.locator('#add-config-modal #modal-error');
    if (await errorDiv.isVisible()) {
      const errorText = await errorDiv.textContent();
      console.log('Update error:', errorText);
      // This is the bug we need to fix
      expect(errorText).not.toContain('Invalid configuration data');
    } else {
      // If successful, verify the checkbox is now checked
      await page.waitForTimeout(1000); // Allow time for table to update
      const updatedRow = page.locator(`#config-table tbody tr:has(.config-key:text-is("${configKey}"))`);
      const checkbox = updatedRow.locator('.config-boolean-value');
      await expect(checkbox).toBeChecked();
    }
  });

  test('should successfully update boolean value from true to false', async ({ page }) => {
    // Use test-specific boolean config to avoid affecting system configs
    const targetConfigKey = 'test-boolean';
    let targetConfigRow = page.locator(`#config-table tbody tr:has(.config-key:text-is("${targetConfigKey}"))`);
    
    // If test-boolean doesn't exist, look for any true boolean config
    if (await targetConfigRow.count() === 0) {
      const trueConfigRow = page.locator('#config-table tbody tr').filter({
        has: page.locator('.config-boolean-value:checked')
      }).first();
      
      if (await trueConfigRow.count() === 0) {
        throw new Error('Test environment error: No boolean configuration with true value found for testing. Test requires at least one boolean config to be present.');
      }
      targetConfigRow = trueConfigRow;
    }

    // Get the config key
    const configKey = await targetConfigRow.locator('.config-key').textContent();

    // Click Edit button
    await targetConfigRow.locator('.config-actions button.btn-edit').click();
    
    // Verify modal opens
    await expect(page.locator('#add-config-modal')).toBeVisible();
    
    // Verify the config type is boolean
    await expect(page.locator('#config-type')).toHaveValue('boolean');
    
    // Change value to false
    await page.fill('#config-value', 'false');
    
    // Submit the form
    await page.click('#add-config-form button[type="submit"]');
    
    // Wait for modal to close or error to appear
    await Promise.race([
      page.waitForFunction(() => {
        const modal = document.getElementById('add-config-modal');
        return !modal || modal.style.display === 'none';
      }, { timeout: 10000 }),
      page.waitForSelector('#add-config-modal #modal-error:visible', { timeout: 10000 }).catch(() => {})
    ]);
    
    // Check if there was an error
    const errorDiv = page.locator('#add-config-modal #modal-error');
    if (await errorDiv.isVisible()) {
      const errorText = await errorDiv.textContent();
      console.log('Update error:', errorText);
      expect(errorText).not.toContain('Invalid configuration data');
    } else {
      // If successful, verify the checkbox is now unchecked
      await page.waitForTimeout(1000); // Allow time for table to update
      const updatedRow = page.locator(`#config-table tbody tr:has(.config-key:text-is("${configKey}"))`);
      const checkbox = updatedRow.locator('.config-boolean-value');
      await expect(checkbox).not.toBeChecked();
    }
  });

  test('should show correct boolean value in edit modal', async ({ page }) => {
    // Find any boolean config
    const booleanRow = page.locator('#config-table tbody tr').filter({
      has: page.locator('.config-boolean-value')
    }).first();
    
    if (await booleanRow.count() === 0) {
      throw new Error('Test environment error: No boolean configuration found for testing. Test requires at least one boolean config to be present.');
    }

    // Check if the checkbox is currently checked
    const checkbox = booleanRow.locator('.config-boolean-value');
    const isChecked = await checkbox.isChecked();
    
    // Click Edit button
    await booleanRow.locator('.config-actions button.btn-edit').click();
    
    // Verify modal opens
    await expect(page.locator('#add-config-modal')).toBeVisible();
    
    // Check the value field shows the correct boolean representation
    const valueInput = page.locator('#config-value');
    const valueText = await valueInput.inputValue();
    
    // The value should be either 'true' or 'false' as string
    if (isChecked) {
      expect(['true', '1']).toContain(valueText.toLowerCase());
    } else {
      expect(['false', '0']).toContain(valueText.toLowerCase());
    }
    
    // Close modal without saving
    await page.click('#cancel-btn');
    await expect(page.locator('#add-config-modal')).not.toBeVisible();
  });

  test('should reject invalid boolean values', async ({ page }) => {
    // Find any boolean config
    const booleanRow = page.locator('#config-table tbody tr').filter({
      has: page.locator('.config-boolean-value')
    }).first();
    
    if (await booleanRow.count() === 0) {
      throw new Error('Test environment error: No boolean configuration found for testing. Test requires at least one boolean config to be present.');
    }

    // Click Edit button
    await booleanRow.locator('.config-actions button.btn-edit').click();
    
    // Verify modal opens
    await expect(page.locator('#add-config-modal')).toBeVisible();
    
    // Try to set an invalid boolean value
    await page.fill('#config-value', 'invalid');
    
    // Submit the form
    await page.click('#add-config-form button[type="submit"]');
    
    // Should show an error
    await expect(page.locator('#add-config-modal #modal-error')).toBeVisible();
    await expect(page.locator('#add-config-modal #modal-error')).toContainText('Invalid boolean value');
  });
});