import { chromium, expect, test as base, type BrowserContext, type Page } from '@playwright/test';
import {
  Category,
  PAGE_RULES,
  type PageExtraction,
  type PageReference,
} from '../../packages/contracts/src/index';
import { extractPage } from '../../apps/extension/src/page/extract-page';
import { PAGE_RULES_PROFILE, PROFILE_HINT } from './profile';

/** Tells whether a page opens without sign-in or needs the local signed-in browser profile. */
enum Access {
  Public = 'public',
  Profile = 'profile',
}

/** Describes one live page and the extraction that the reviewed rules must give. */
interface PageCase {
  name: string;
  url: string;
  access: Access;
  title: string;
  category: Category | null;
  references?: PageReference[];
  ruleId: string | null;
  searchOnly?: boolean;
  /** Selector of the element whose text the user selects before the read. */
  select?: string;
  /** Selector of an element to point at, so that the page shows its title. */
  hover?: string;
  /** Selector that must be in the page before the read. */
  ready?: string;
}

const CASES: PageCase[] = [
  {
    name: 'animego',
    url: 'https://animego.me/anime/ao-asi-2-3813',
    access: Access.Public,
    title: 'Ао Аси 2',
    category: Category.Anime,
    ruleId: 'animego',
  },
  {
    name: 'animesss',
    url: 'https://animesss.com/aniserials/video/action/1002-bespodobnyj-boevoj-duh.html',
    access: Access.Public,
    title: 'Бесподобный боевой дух',
    category: Category.Anime,
    ruleId: 'animesss',
  },
  {
    name: 'smotret',
    url: 'https://smotret-anime.org/catalog/sousou-no-frieren-30414',
    access: Access.Public,
    title: 'Провожающая в последний путь Фрирен',
    category: Category.Anime,
    references: [{ namespace: 'smotret', entity: 'series', id: '30414' }],
    ruleId: 'smotret',
  },
  {
    name: 'shikimori',
    url: 'https://shikimori.io/animes/50668-mahoutsukai-no-yoru',
    access: Access.Public,
    title: 'Ночь ведьм',
    category: Category.Anime,
    references: [{ namespace: 'myanimelist', entity: 'anime', id: '50668' }],
    ruleId: 'shikimori',
  },
  {
    name: 'dreamerscast',
    url: 'https://dreamerscast.com/home/release/564-yozakura-san-chi-no-daisakusen-2',
    access: Access.Public,
    title: 'Операция: Семейка Ёдзакура 2',
    category: Category.Anime,
    ruleId: 'dreamerscast',
  },
  {
    name: 'jutsu',
    url: 'https://jut.su/naruuto/',
    access: Access.Profile,
    title: 'Наруто',
    category: Category.Anime,
    ruleId: 'jutsu',
  },
  {
    name: 'mail-kino-film',
    url: 'https://kino.mail.ru/cinema/movies/946211_les/',
    access: Access.Public,
    title: 'Лес',
    category: Category.Films,
    ruleId: 'mail-kino',
  },
  {
    name: 'ivi-video',
    url: 'https://www.ivi.tv/watch/rabari-zamuzh-tolko-za-rodstvennika-drugoj-mir',
    access: Access.Public,
    title: 'Рабари: замуж только за родственника. Другой Мир',
    category: null,
    ruleId: 'ivi',
  },
  {
    name: 'ivi-series',
    url: 'https://www.ivi.ru/watch/vozmezdiye-2019',
    access: Access.Public,
    title: 'Возмездие',
    category: Category.Tv,
    ruleId: 'ivi',
  },
  {
    name: 'kinopoisk-film',
    url: 'https://www.kinopoisk.ru/film/301/',
    access: Access.Profile,
    title: 'Матрица',
    category: Category.Films,
    references: [{ namespace: 'kinopoisk', entity: 'title', id: '301' }],
    ruleId: 'kinopoisk',
  },
  {
    name: 'kinopoisk-series',
    url: 'https://www.kinopoisk.ru/series/77044/',
    access: Access.Profile,
    title: 'Друзья',
    category: Category.Tv,
    references: [{ namespace: 'kinopoisk', entity: 'title', id: '77044' }],
    ruleId: 'kinopoisk',
  },
  {
    name: 'netflix-series',
    url: 'https://www.netflix.com/title/80057281',
    access: Access.Public,
    title: 'Stranger Things',
    category: Category.Tv,
    ruleId: 'netflix',
  },
  {
    name: 'netflix-film',
    url: 'https://www.netflix.com/title/80209042',
    access: Access.Public,
    title: 'Tomb Raider',
    category: Category.Films,
    ruleId: 'netflix',
  },
  {
    name: 'netflix-anime-series',
    url: 'https://www.netflix.com/title/80050063',
    access: Access.Public,
    title: 'The Seven Deadly Sins',
    category: Category.Anime,
    ruleId: 'netflix',
  },
  {
    name: 'netflix-player',
    url: 'https://www.netflix.com/watch/81946364',
    access: Access.Profile,
    title: 'Cyberpunk: Edgerunners',
    category: null,
    ruleId: 'netflix',
    ready: '[data-uia="player"]',
    hover: '[data-uia="player"]',
  },
  {
    name: 'crunchyroll-series',
    url: 'https://www.crunchyroll.com/series/GY5P48XEY/demon-slayer-kimetsu-no-yaiba',
    access: Access.Profile,
    title: 'Demon Slayer: Kimetsu no Yaiba',
    category: Category.Anime,
    ruleId: 'crunchyroll',
  },
  {
    name: 'mirf-selection',
    url: 'https://mirf.ru/news/kris-pratt-sygraet-puteshestvennika-vo-vremeni',
    access: Access.Public,
    title: 'Крис Пратт сыграет путешественника во времени',
    category: Category.Anime,
    ruleId: 'mirf',
    searchOnly: true,
    select: 'h1',
  },
  {
    name: 'unknown',
    url: 'https://example.com/',
    access: Access.Public,
    title: 'Example Domain',
    category: null,
    ruleId: null,
  },
];

const test = base.extend<object, { profile: BrowserContext | null }>({
  profile: [
    async ({}, use) => {
      if (!PAGE_RULES_PROFILE) return use(null);

      const context = await chromium.launchPersistentContext(PAGE_RULES_PROFILE, {
        headless: false,
      });

      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],
});

/** Opens the live page and runs the engine as `executeScript` does: serialized. */
async function extract(page: Page, item: PageCase): Promise<PageExtraction> {
  await page.goto(item.url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);

  if (item.ready) await page.locator(item.ready).first().waitFor();

  if (item.hover) await page.locator(item.hover).first().hover();

  if (item.select)
    await page.evaluate((selector) => {
      const range = document.createRange();

      range.selectNodeContents(document.querySelector(selector)!);
      window.getSelection()!.addRange(range);
    }, item.select);

  // The extension selects the rule by the host of the final tab URL, after redirects.
  const host = new URL(page.url()).hostname.replace(/^www\./, '');
  const site = PAGE_RULES.sites.find((rule) => rule.hosts.includes(host)) ?? null;

  return page.evaluate(
    `(${extractPage.toString()})(${JSON.stringify(site)}, ${JSON.stringify(PAGE_RULES.fallback)})`,
  );
}

for (const item of CASES)
  test(`page rule ${item.ruleId ?? 'fallback'} reads ${item.name}`, async ({ page, profile }) => {
    if (item.access === Access.Profile) test.skip(!profile, PROFILE_HINT);

    const target = item.access === Access.Profile ? await profile!.newPage() : page;
    const result = await extract(target, item);

    expect(result).toEqual({
      url: target.url(),
      title: item.title,
      category: item.category,
      references: item.references ?? [],
      ruleId: item.ruleId,
      searchOnly: item.searchOnly ?? false,
    });

    if (target !== page) await target.close();
  });

test('every site rule and every host has a live case', () => {
  const hosts = new Set(CASES.map(({ url }) => new URL(url).hostname.replace(/^www\./, '')));
  const covered = new Set(CASES.map(({ ruleId }) => ruleId));

  for (const site of PAGE_RULES.sites) expect(covered, site.id).toContain(site.id);

  const uncovered = PAGE_RULES.sites
    .flatMap((site) => site.hosts)
    .filter((host) => !hosts.has(host));
  // Alias hosts share the rule of a covered host. List them so that a review sees them.
  expect(uncovered.sort()).toEqual(
    [
      'afisha.mail.ru',
      'animego.org',
      'hd.kinopoisk.ru',
      'shikimori.one',
      'smotret-anime.co',
      'smotret-anime.online',
    ].sort(),
  );
});
