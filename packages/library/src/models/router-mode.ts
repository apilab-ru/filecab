/** Selects how the shell keeps the route in the URL. */
export enum RouterMode {
  /** Path routes, such as `/library/anime`. The website uses them. */
  Browser = 'browser',
  /** Hash routes, such as `#/library/anime`. Extension pages use them. */
  Hash = 'hash',
}
