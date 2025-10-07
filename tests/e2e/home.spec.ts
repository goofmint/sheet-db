import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display admin dashboard', async ({ page }) => {
    await page.goto('/');

    // Check if the page title is correct
    await expect(page).toHaveTitle(/Sheet DB Admin/);

    // Check if the heading is displayed
    const heading = page.locator('h1');
    await expect(heading).toContainText('Sheet DB Admin Dashboard');

    // Check if welcome message is displayed
    const welcomeText = page.locator('p');
    await expect(welcomeText).toContainText('Welcome to the admin panel');
  });
});

test.describe('Health API', () => {
  test('should return ok status from health endpoint', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('ok');
    expect(data.data.timestamp).toBeDefined();
  });
});
