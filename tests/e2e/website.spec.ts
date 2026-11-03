import { expect, test } from '@playwright/test';

test('website bootstraps without extension APIs or console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Filecab');
  await expect(page.getByRole('heading', { name: 'Filecab' })).toBeVisible();
  expect(errors).toEqual([]);
});
