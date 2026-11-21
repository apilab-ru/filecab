import type { Page } from '@playwright/test';

/** Activates an action on the first visible library card. */
export async function cardAction(page: Page, name: string) {
  await page
    .locator('.library-card:visible')
    .first()
    .getByRole('button', { name, exact: true })
    .click();
}
