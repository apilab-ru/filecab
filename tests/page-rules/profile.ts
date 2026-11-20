/** Local browser profile directory with the sign-ins that some sites require. Never committed. */
export const PAGE_RULES_PROFILE = process.env.FILECAB_PAGE_RULES_PROFILE;

export const PROFILE_HINT =
  'Needs a signed-in profile: run `pnpm test:page-rules:sign-in`, then set FILECAB_PAGE_RULES_PROFILE.';

/** Pages to open for the one-time manual sign-in. */
export const SIGN_IN_PAGES = [
  'https://www.kinopoisk.ru/film/301/',
  'https://jut.su/naruuto/',
  'https://www.crunchyroll.com/',
  'https://www.netflix.com/login',
];
