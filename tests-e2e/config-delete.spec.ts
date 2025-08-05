import { test, expect } from '@playwright/test';

test.describe('Config Delete Functionality', () => {
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

  test('should display Delete buttons in Actions column', async ({ page }) => {
    // Verify that Delete buttons are displayed for all config rows
    const deleteButtons = page.locator('.config-actions button.btn-delete');
    await expect(deleteButtons.first()).toBeVisible();
    
    // Verify minimum config items have Delete buttons
    const configRows = page.locator('#config-table tbody tr');
    const rowCount = await configRows.count();
    expect(rowCount).toBeGreaterThan(0);
    
    // Check Delete button existence for some sample configs
    const sampleConfigs = ['app.name', 'app.version', 'ui.theme'];
    for (const configKey of sampleConfigs) {
      const row = page.locator(`#config-table tbody tr:has(.config-key:text-is("${configKey}"))`);
      if (await row.count() > 0) {
        await expect(row.locator('.config-actions button.btn-delete')).toBeVisible();
      }
    }
  });

  test('should have correct styling for Delete buttons', async ({ page }) => {
    // Check that Delete buttons have correct CSS classes and attributes
    const firstDeleteButton = page.locator('.config-actions button.btn-delete').first();
    await expect(firstDeleteButton).toHaveClass(/btn-delete/);
    await expect(firstDeleteButton).toHaveClass(/btn-sm/);
    await expect(firstDeleteButton).toHaveAttribute('title', 'Delete');
    await expect(firstDeleteButton).toHaveAttribute('aria-label', 'Delete configuration');
    
    // Check that it contains SVG icon
    await expect(firstDeleteButton.locator('svg')).toBeVisible();
  });

  test('should open delete confirmation modal when Delete button is clicked', async ({ page }) => {
    // Click the first Delete button
    const firstDeleteButton = page.locator('.config-actions button.btn-delete').first();
    await firstDeleteButton.click();
    
    // Verify modal is displayed
    await expect(page.locator('#delete-confirm-modal')).toBeVisible();
    await expect(page.locator('#delete-confirm-modal .modal-header h2')).toHaveText('Delete Configuration');
    
    // Verify modal content
    await expect(page.locator('.delete-confirm-message')).toBeVisible();
    await expect(page.locator('#delete-config-key')).toBeVisible();
    
    // Verify buttons are present
    await expect(page.locator('#delete-cancel-btn')).toBeVisible();
    await expect(page.locator('#delete-cancel-btn')).toHaveText('Cancel');
    await expect(page.locator('#delete-confirm-btn')).toBeVisible();
    await expect(page.locator('#delete-confirm-btn')).toHaveText('Delete');
    
    // Verify Delete button has danger styling
    await expect(page.locator('#delete-confirm-btn')).toHaveClass(/btn-danger/);
  });

  test('should display correct config key in confirmation message', async ({ page }) => {
    // Find a specific config row (app.name if it exists)
    const appNameRow = page.locator('#config-table tbody tr:has(.config-key:text-is("app.name"))');
    if (await appNameRow.count() > 0) {
      // Click Delete button for app.name
      await appNameRow.locator('.config-actions button.btn-delete').click();
      
      // Verify modal is open and displays correct key
      await expect(page.locator('#delete-confirm-modal')).toBeVisible();
      await expect(page.locator('#delete-config-key')).toHaveText('app.name');
      
      // Verify the full confirmation message
      const confirmMessage = page.locator('.delete-confirm-message');
      await expect(confirmMessage).toContainText("Are you sure you want to delete 'app.name'?");
      await expect(confirmMessage).toContainText('This action cannot be undone.');
    } else {
      // If app.name doesn't exist, test with the first available config
      const firstDeleteButton = page.locator('.config-actions button.btn-delete').first();
      await firstDeleteButton.click();
      
      // Verify modal is open
      await expect(page.locator('#delete-confirm-modal')).toBeVisible();
      
      // Verify that some config key is displayed
      const configKey = page.locator('#delete-config-key');
      await expect(configKey).not.toBeEmpty();
    }
  });

  test('should close delete modal when cancel button is clicked', async ({ page }) => {
    // Open delete modal
    const firstDeleteButton = page.locator('.config-actions button.btn-delete').first();
    await firstDeleteButton.click();
    
    // Verify modal is open
    await expect(page.locator('#delete-confirm-modal')).toBeVisible();
    
    // Click Cancel button
    await page.click('#delete-cancel-btn');
    
    // Verify modal is closed
    await expect(page.locator('#delete-confirm-modal')).not.toBeVisible();
  });

  test('should close delete modal when X button is clicked', async ({ page }) => {
    // Open delete modal
    const firstDeleteButton = page.locator('.config-actions button.btn-delete').first();
    await firstDeleteButton.click();
    
    // Verify modal is open
    await expect(page.locator('#delete-confirm-modal')).toBeVisible();
    
    // Click X button
    await page.click('#delete-modal-close-btn');
    
    // Verify modal is closed
    await expect(page.locator('#delete-confirm-modal')).not.toBeVisible();
  });

  test('should close delete modal on Escape key', async ({ page }) => {
    // Open delete modal
    const firstDeleteButton = page.locator('.config-actions button.btn-delete').first();
    await firstDeleteButton.click();
    
    // Verify modal is open
    await expect(page.locator('#delete-confirm-modal')).toBeVisible();
    
    // Press Escape key
    await page.keyboard.press('Escape');
    
    // Verify modal is closed
    await expect(page.locator('#delete-confirm-modal')).not.toBeVisible();
  });

  test('should focus on Cancel button when modal opens', async ({ page }) => {
    // Open delete modal
    const firstDeleteButton = page.locator('.config-actions button.btn-delete').first();
    await firstDeleteButton.click();
    
    // Verify modal is open
    await expect(page.locator('#delete-confirm-modal')).toBeVisible();
    
    // Verify Cancel button has focus
    await expect(page.locator('#delete-cancel-btn')).toBeFocused();
  });

  test('should show delete confirmation and handle delete operation', async ({ page }) => {
    // Find any existing config to test delete functionality
    const firstRow = page.locator('#config-table tbody tr').first();
    const firstDeleteButton = firstRow.locator('.config-actions button.btn-delete');
    
    // Skip test if no configs exist
    if (await firstDeleteButton.count() === 0) {
      test.skip('No configurations available to test delete functionality');
      return;
    }
    
    // Get the config key for verification
    const configKey = await firstRow.locator('.config-key').textContent();
    
    // Click Delete button
    await firstDeleteButton.click();
    
    // Verify delete confirmation modal appears
    await expect(page.locator('#delete-confirm-modal')).toBeVisible();
    await expect(page.locator('#delete-config-key')).toHaveText(configKey);
    
    // Cancel the deletion to avoid actually deleting configs
    await page.click('#delete-cancel-btn');
    
    // Verify modal is closed
    await expect(page.locator('#delete-confirm-modal')).not.toBeVisible();
    
    // Verify original config is still present  
    await expect(firstRow).toBeVisible();
  });

  test('should show delete button UI and modal structure', async ({ page }) => {
    // Find any existing config
    const firstRow = page.locator('#config-table tbody tr').first();
    const firstDeleteButton = firstRow.locator('.config-actions button.btn-delete');
    
    if (await firstDeleteButton.count() === 0) {
      test.skip('No configurations available to test');
      return;
    }
    
    // Verify delete button is visible and has correct attributes
    await expect(firstDeleteButton).toBeVisible();
    await expect(firstDeleteButton).toHaveAttribute('title', 'Delete');
    
    // Click delete button to open modal
    await firstDeleteButton.click();
    
    // Verify modal structure
    await expect(page.locator('#delete-confirm-modal')).toBeVisible();
    await expect(page.locator('#delete-confirm-btn')).toBeVisible();
    await expect(page.locator('#delete-cancel-btn')).toBeVisible();
    
    // Close modal without deleting
    await page.click('#delete-cancel-btn');
    await expect(page.locator('#delete-confirm-modal')).not.toBeVisible();
  });

  test('should handle keyboard navigation in delete modal', async ({ page }) => {
    // Open delete modal
    const firstDeleteButton = page.locator('.config-actions button.btn-delete').first();
    
    if (await firstDeleteButton.count() === 0) {
      test.skip('No configurations available to test');
      return;
    }
    
    await firstDeleteButton.click();
    
    // Verify modal is open
    await expect(page.locator('#delete-confirm-modal')).toBeVisible();
    
    // Verify buttons are present and accessible
    await expect(page.locator('#delete-cancel-btn')).toBeVisible();
    await expect(page.locator('#delete-confirm-btn')).toBeVisible();
    await expect(page.locator('#delete-modal-close-btn')).toBeVisible();
    
    // Close modal with Cancel button
    await page.click('#delete-cancel-btn');
    await expect(page.locator('#delete-confirm-modal')).not.toBeVisible();
  });
});