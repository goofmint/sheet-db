import { test, expect } from '@playwright/test';

test.describe('Config Authentication', () => {
  const CONFIG_PASSWORD = process.env.TOKEN || 'defaultTestPassword';

  test('should show login form on config page load', async ({ page }) => {
    await page.goto('/config');
    
    // 認証フォームが表示されることを確認
    await expect(page.locator('#auth-form')).toBeVisible();
    await expect(page.locator('#password-input')).toBeVisible();
    await expect(page.locator('#auth-form button[type="submit"]')).toBeVisible();
    
    // 設定コンテナは非表示であることを確認
    await expect(page.locator('#config-container')).toHaveCSS('display', 'none');
  });

  test('should authenticate and show config table with valid password', async ({ page }) => {
    await page.goto('/config');
    
    // パスワードを入力してログイン
    await page.fill('#password-input', CONFIG_PASSWORD);
    await page.click('#auth-form button[type="submit"]');
    
    // 設定コンテナが表示されることを確認
    await page.waitForFunction(() => {
      const container = document.getElementById('config-container');
      return container && container.style.display === 'block';
    }, { timeout: 10000 });
    await expect(page.locator('#config-container')).toBeVisible();
    
    // 認証フォームが非表示になることを確認
    await expect(page.locator('#auth-form')).toHaveCSS('display', 'none');
    
    // 設定テーブルが表示されることを確認
    await expect(page.locator('#config-table')).toBeVisible();
    await expect(page.locator('#config-table thead')).toBeVisible();
    await expect(page.locator('#config-table tbody')).toBeVisible();
  });

  test('should show error message with invalid password', async ({ page }) => {
    await page.goto('/config');
    
    // 無効なパスワードを入力
    await page.fill('#password-input', 'wrongPassword');
    await page.click('#auth-form button[type="submit"]');
    
    // エラーメッセージが表示されることを確認
    await expect(page.locator('#error')).toBeVisible();
    await expect(page.locator('#error')).toHaveText('Invalid password');
    
    // 設定コンテナは非表示のままであることを確認
    await expect(page.locator('#config-container')).toHaveCSS('display', 'none');
  });

  test('should show browser validation for empty password field', async ({ page }) => {
    await page.goto('/config');
    
    // 空のパスワードフィールドでログインを試行
    await page.click('#auth-form button[type="submit"]');
    
    // HTML5のrequired属性によってブラウザがバリデーションを表示することを確認
    const passwordInput = page.locator('#password-input');
    await expect(passwordInput).toBeFocused();
    
    // または、required属性があることを確認
    await expect(passwordInput).toHaveAttribute('required');
  });

  test('should logout and return to login form', async ({ page }) => {
    await page.goto('/config');
    
    // ログイン
    await page.fill('#password-input', CONFIG_PASSWORD);
    await page.click('#auth-form button[type="submit"]');
    
    // 設定コンテナが表示されることを確認
    await page.waitForFunction(() => {
      const container = document.getElementById('config-container');
      return container && container.style.display === 'block';
    }, { timeout: 10000 });
    
    // ログアウトボタンをクリック
    await page.click('#logout-btn');
    
    // 認証フォームが再度表示されることを確認
    await expect(page.locator('#auth-form')).toBeVisible();
    await expect(page.locator('#config-container')).toHaveCSS('display', 'none');
    
    // パスワードフィールドがクリアされていることを確認
    await expect(page.locator('#password-input')).toHaveValue('');
    
    // エラーメッセージが非表示であることを確認
    await expect(page.locator('#error')).toHaveCSS('display', 'none');
  });
});