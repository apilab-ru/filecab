import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useTranslation } from 'react-i18next';
import './library-card.scss';

import { useLocalStore } from '../../hooks/use-local-store';

import { titleFor } from '@filecab/contracts';
import { Button, Icon, IconName } from '@filecab/ui';
import type { LibraryCardProps } from './model-library-card';

/** Renders a saved entry with truthful poster, status, progress and personal rating. */
export function LibraryCard({ entry, edit, remove }: LibraryCardProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const [{ failedPoster }, { failedPoster: setFailedPoster }] = useLocalStore(() => ({
    failedPoster: null as string | null,
  }));
  const title = titleFor(entry.snapshot, locale, t('Untitled'), entry.userTitle).text;
  const total = entry.snapshot.episodeCount;
  const progress = total && total > 0 ? Math.min(100, (entry.progress / total) * 100) : 0;
  const number = new Intl.NumberFormat(locale);

  return (
    <li className="library-card local-library__entry">
      <div className="library-card__artwork">
        {entry.snapshot.posterUrl && failedPoster !== entry.snapshot.posterUrl ? (
          <img
            className="library-card__poster"
            src={entry.snapshot.posterUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedPoster(entry.snapshot.posterUrl)}
          />
        ) : (
          <div className="library-card__placeholder">
            <Icon name={IconName.Library} />
            <span>{t('noPoster')}</span>
          </div>
        )}
        {entry.status && (
          <span className={`library-card__status library-card__status--${entry.status}`}>
            {t(entry.status)}
          </span>
        )}
        {(edit || remove) && (
          <details className="library-card__menu">
            <summary className="library-card__menu-trigger" aria-label={t('entryActions')}>
              <Icon name={IconName.More} />
            </summary>
            <div className="library-card__menu-actions">
              {edit && (
                <Button
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    edit();
                  }}
                >
                  {t('Edit')}
                </Button>
              )}
              {remove && (
                <Button
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    remove();
                  }}
                >
                  {t('Delete')}
                </Button>
              )}
            </div>
          </details>
        )}
      </div>
      <div className="library-card__body">
        <span className="library-card__title local-library__entry-title" title={title}>
          {title}
        </span>
        <span className="library-card__year">{entry.snapshot.year ?? t('unknownYear')}</span>
        <div className="library-card__stats">
          <span>
            {number.format(entry.progress)} / {total === null ? '?' : number.format(total)}
          </span>
          <span className="library-card__rating">
            <span className="library-card__star">
              <Icon name={entry.rating > 0 ? IconName.Star : IconName.StarOutline} />
            </span>{' '}
            {entry.rating > 0 ? `${number.format(entry.rating)} / 10` : t('unrated')}
          </span>
        </div>
        <div className="library-card__track" aria-hidden="true">
          <div className="library-card__fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </li>
  );
}
