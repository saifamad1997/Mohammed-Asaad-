import { test, expect } from '@playwright/test';

test('application shell loads without uncaught browser errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  const response = await page.goto('/');
  expect(response, 'Vite preview should return a response').not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#app')).not.toBeEmpty();
  await expect(page).toHaveTitle(/محمد أسعد/);

  expect(pageErrors, 'Uncaught JavaScript errors').toEqual([]);
});

test('application remains usable at a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#app')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-home.png', fullPage: true });
});

test('engineering studio stays behind the sign-in gate', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-page="studio"]').click();
  await expect(page.locator('#pageTitle')).toHaveText('المهندس الذكي 3D');
  await expect(page.locator('#pageContent')).toContainText('سجّل الدخول للمتابعة');
});

test('mobile shell does not create horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});
