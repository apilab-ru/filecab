import { chromium, test } from '@playwright/test';
import { PAGE_RULES_PROFILE, SIGN_IN_PAGES } from './profile';

test('sign in to the page rule profile', async () => {
  test.setTimeout(0);

  if (!PAGE_RULES_PROFILE) throw new Error('Set FILECAB_PAGE_RULES_PROFILE to a local directory.');

  // A person signs in and passes the site checks in a visible browser, then closes it.
  const context = await chromium.launchPersistentContext(PAGE_RULES_PROFILE, { headless: false });

  for (const url of SIGN_IN_PAGES) await (await context.newPage()).goto(url);

  await new Promise((resolve) => context.on('close', resolve));
});
