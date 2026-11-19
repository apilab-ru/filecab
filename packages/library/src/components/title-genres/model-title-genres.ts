import type { Genre } from '@filecab/contracts';

/** Supplies catalog genres and an optional genre filter action. */
export interface TitleGenresProps {
  genres: Genre[];
  onSelect?: (genreId: string) => void;
}

/** Maps internal genre keys to glyphs of the genre icon font. Genres without a glyph show only as text. */
export const GENRE_ICONS: Partial<Record<string, string>> = {
  action: '',
  adventure: '',
  psychological: '',
  drama: '',
  demons: '',
  romance: '',
  yaoi: '',
  shoujo: '',
  ecchi: '',
  mecha: '',
  seinen: '',
  music: '',
  musical: '',
  'martial-arts': '',
  hentai: '',
  magic: '',
  yuri: '',
  school: '',
  'action-battle': '',
  sports: '',
  cars: '',
  'super-power': '',
  crazy: '',
  military: '',
  thriller: '',
  parody: '',
  josei: '',
  fantasy: '',
  space: '',
  horror: '',
  mystery: '',
  detective: '',
  'sci-fi': '',
  histori: '',
  kids: '',
  children: '',
  supernatural: '',
  harem: '',
  police: '',
  crime: '',
  samurai: '',
  'slice-of-life': '',
  vampire: '',
  isekai: '',
  game: '',
  comedy: '',
};
