import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('preference hooks update the same document when persistence is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Storage unavailable');
    };
  });
  await page.goto('/#/settings');
  await page.getByLabel('Language', { exact: true }).selectOption('ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { name: 'Оформление', exact: true })).toBeVisible();
  await expect(page.getByLabel('Язык', { exact: true })).toHaveValue('ru');
  await page.getByRole('button', { name: 'Тёмное', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Тёмное', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Библиотека', exact: true }).click();
  await expect(page).toHaveURL(/#\/library\/anime$/);
  await page.getByRole('button', { name: 'Поиск в каталоге', exact: true }).click();
  await expect(
    page.getByText(
      'Поиск в каталоге пока недоступен. Можно добавлять записи вручную в библиотеке.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Тёмное', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('composed extension layouts share preferences across surfaces and retain draft protection', async () => {
  const extensionPath = resolve('apps/extension/.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const origin = `chrome-extension://${new URL(worker.url()).host}`;
    const fullPage = await context.newPage();
    await fullPage.goto(`${origin}/full-page.html#/library/anime`);
    await fullPage.getByRole('button', { name: 'Add manual entry' }).click();
    const title = fullPage.locator('.local-editor__input[name="title"]');
    await title.fill('Keep this unsaved draft');
    const popup = await context.newPage();
    await popup.goto(`${origin}/popup.html#/settings`);
    await popup.getByLabel('Language', { exact: true }).selectOption('ru');
    await expect(fullPage.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(fullPage.getByLabel('Язык', { exact: true })).toHaveValue('ru');
    await expect(title).toHaveValue('Keep this unsaved draft');
    await popup.getByRole('button', { name: 'Тёмное', exact: true }).click();
    await expect(fullPage.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(title).toHaveValue('Keep this unsaved draft');
    await fullPage.getByRole('button', { name: 'Настройки', exact: true }).click();
    await expect(fullPage.getByRole('dialog')).toBeVisible();
    await fullPage.getByRole('button', { name: 'Продолжить редактирование', exact: true }).click();
    await expect(fullPage.getByRole('dialog')).toHaveCount(0);
    await expect(title).toHaveValue('Keep this unsaved draft');
    await popup.reload();
    await expect(popup.getByLabel('Язык', { exact: true })).toHaveValue('ru');
    await expect(popup.getByRole('button', { name: 'Тёмное', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await popup.getByRole('button', { name: 'Назад', exact: true }).click();
    await expect(popup).toHaveURL(/#\/page\/anime$/);
  } finally {
    await context.close();
  }
});
