import { test, expect } from '@playwright/test';
test('application shell loads', async ({ page }) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto('/');
  expect(response.status()).toBeLessThan(400);
  await expect(page.locator('#app')).toBeVisible();
  await expect(page).toHaveTitle(/محمد أسعد/);
  expect(errors).toEqual([]);
});
test('mobile layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/');
  const sizes=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
  expect(sizes.s).toBeLessThanOrEqual(sizes.w+1);
});