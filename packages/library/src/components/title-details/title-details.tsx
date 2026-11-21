import { descriptionFor, genreLabelFor } from '@filecab/contracts';
import { useTranslation } from 'react-i18next';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { isViewingUrl } from '../../domain/entry-form';
import type { TitleDetailsProps } from './model-title-details';
import './title-details.scss';

/** Shows the title, metadata, description and viewing link over a card. A personal note is marked. */
export function TitleDetails({
  id,
  title,
  snapshot,
  comment,
  sources,
  onGenre,
}: TitleDetailsProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const description = descriptionFor(snapshot, locale, comment, t('noDescription'));
  const link = sources[0]?.originalUrl;

  const number = new Intl.NumberFormat(locale);
  const metadata = [
    snapshot.year,
    snapshot.episodeCount === null
      ? null
      : `${t('episodes')}: ${number.format(snapshot.episodeCount)}`,
  ].filter((item) => item !== null);

  return (
    <div className="title-details" id={id}>
      <p className="title-details__title">{title}</p>
      {metadata.length > 0 && <p className="title-details__metadata">{metadata.join(' · ')}</p>}
      {snapshot.genres.length > 0 && (
        <ul className="title-details__list" aria-label={t('genres')}>
          {snapshot.genres.map((genre) => {
            const label = genreLabelFor(genre, locale).text;

            return (
              <li className="title-details__item" key={genre.genreId}>
                {onGenre ? (
                  <button
                    type="button"
                    className="title-details__genre"
                    aria-label={t('filterByGenre', { genre: label })}
                    onClick={() => onGenre(genre.genreId)}
                  >
                    {label}
                  </button>
                ) : (
                  <span className="title-details__genre">{label}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {description.origin === 'user' && <p className="title-details__label">{t('personalNote')}</p>}
      <p className={`title-details__text title-details__text--${description.origin}`}>
        {description.text}
      </p>
      {link && (
        <>
          <p className="title-details__label">{t('ViewingLink')}</p>
          {isViewingUrl(link) ? (
            <a
              className="title-details__link"
              href={link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {new URL(link).hostname}
            </a>
          ) : (
            <span className="title-details__link">{link}</span>
          )}
        </>
      )}
    </div>
  );
}
