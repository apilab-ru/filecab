import type { Page } from '@playwright/test';

/** Opens one action from the menu of the first visible library card. */
export async function cardAction(page: Page, name: string) {
  await page.locator('.library-card__menu-trigger:visible').first().click();
  await page
    .locator('.library-card:visible')
    .first()
    .getByRole('button', { name, exact: true })
    .click();
}
