import { genreLabelFor } from '@filecab/contracts';
import { useTranslation } from 'react-i18next';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { GENRE_ICONS, type TitleGenresProps } from './model-title-genres';
import '../../styles/genre-icons/genre-icons.scss';
import './title-genres.scss';

/** Shows genre icons over a poster. Each icon names its genre and can apply the genre filter. */
export function TitleGenres({ genres, onSelect }: TitleGenresProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const icons = genres.flatMap((genre) => {
    const glyph = GENRE_ICONS[genre.key];

    return glyph ? [{ genre, glyph, label: genreLabelFor(genre, locale).text }] : [];
  });

  if (!icons.length) return null;

  return (
    <ul className="title-genres" aria-label={t('genres')}>
      {icons.map(({ genre, glyph, label }) => (
        <li className="title-genres__item" key={genre.genreId}>
          {onSelect ? (
            <button
              type="button"
              className="title-genres__button"
              title={label}
              aria-label={t('filterByGenre', { genre: label })}
              onClick={() => onSelect(genre.genreId)}
            >
              <span className="genre-icon" aria-hidden="true">
                {glyph}
              </span>
            </button>
          ) : (
            <span
              className="title-genres__icon genre-icon"
              role="img"
              aria-label={label}
              title={label}
            >
              {glyph}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
