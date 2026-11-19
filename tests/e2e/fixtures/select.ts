import type { Page } from '@playwright/test';

/** Chooses one option in a shared Base UI select by its accessible name. */
export async function choose(page: Page, name: string, option: string) {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
