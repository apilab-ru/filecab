import type { Locator, Page } from '@playwright/test';

/**
 * Chooses one option in a shared Base UI select by its accessible name. A scope selects the
 * control when other controls have the same name, for example the status of each card.
 */
export async function choose(page: Page, name: string, option: string, scope?: Locator) {
  await (scope ?? page).getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
