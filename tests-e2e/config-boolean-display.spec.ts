import { test, expect } from '@playwright/test';

test.describe('Boolean Configuration Display', () => {
  const CONFIG_PASSWORD = process.env.TOKEN || 'defaultTestPassword';

  test.beforeEach(async ({ page }) => {
    // 設定ページにアクセスしてログイン
    await page.goto('/config');
    await page.fill('#password-input', CONFIG_PASSWORD);
    await page.click('#auth-form button[type="submit"]');
    
    // 設定コンテナが表示されるまで待機
    await page.waitForFunction(() => {
      const container = document.getElementById('config-container');
      return container && container.style.display === 'block';
    }, { timeout: 10000 });
    
    // 設定テーブルのデータが読み込まれるまで待機
    await page.waitForFunction(() => {
      const tbody = document.querySelector('#config-table tbody');
      return tbody && tbody.children.length > 0 && 
             !tbody.textContent?.includes('Loading...');
    }, { timeout: 10000 });
  });


  test('should show api.sheet.allow_create as checked when value is true', async ({ page }) => {
    // api.sheet.allow_createの行を特定
    const allowCreateRow = page.locator('#config-table tbody tr:has(.config-key:text-is("api.sheet.allow_create"))');
    await expect(allowCreateRow).toBeVisible();
    
    // チェックボックスが存在することを確認
    const checkbox = allowCreateRow.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    
    // データベースの値がtrueなので、チェックボックスはチェックされているべき
    await expect(checkbox).toBeChecked();
  });

  test('should show app.setup_completed as checked when value is true', async ({ page }) => {
    // app.setup_completedの行を特定
    const setupCompletedRow = page.locator('#config-table tbody tr:has(.config-key:text-is("app.setup_completed"))');
    await expect(setupCompletedRow).toBeVisible();
    
    // チェックボックスが存在することを確認
    const checkbox = setupCompletedRow.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    
    // データベースの値がtrueなので、チェックボックスはチェックされているべき
    await expect(checkbox).toBeChecked();
  });

  test('should show api.sheet.allow_modify as unchecked when value is false', async ({ page }) => {
    // api.sheet.allow_modifyの行を特定
    const allowModifyRow = page.locator('#config-table tbody tr:has(.config-key:text-is("api.sheet.allow_modify"))');
    await expect(allowModifyRow).toBeVisible();
    
    // チェックボックスが存在することを確認
    const checkbox = allowModifyRow.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    
    // データベースの値がfalseなので、チェックボックスはチェックされていないべき
    await expect(checkbox).not.toBeChecked();
  });

  test('should show api.sheet.allow_delete as unchecked when value is false', async ({ page }) => {
    // api.sheet.allow_deleteの行を特定
    const allowDeleteRow = page.locator('#config-table tbody tr:has(.config-key:text-is("api.sheet.allow_delete"))');
    await expect(allowDeleteRow).toBeVisible();
    
    // チェックボックスが存在することを確認
    const checkbox = allowDeleteRow.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    
    // データベースの値がfalseなので、チェックボックスはチェックされていないべき
    await expect(checkbox).not.toBeChecked();
  });

  test('boolean checkboxes should be disabled for display only', async ({ page }) => {
    // すべてのboolean型のチェックボックスが無効化されていることを確認（表示専用）
    const booleanCheckboxes = page.locator('#config-table input[type="checkbox"]');
    const count = await booleanCheckboxes.count();
    
    for (let i = 0; i < count; i++) {
      const checkbox = booleanCheckboxes.nth(i);
      await expect(checkbox).toBeDisabled();
    }
  });
});