import { useId, useRef } from 'react';
import { useEntryUpdate } from '../../hooks/use-entry-update';
import { ProgressControl } from '../progress-control/progress-control';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useTranslation } from 'react-i18next';
import './library-card.scss';

import { useLocalStore } from '../../hooks/use-local-store';

import { titleFor } from '@filecab/contracts';
import { Button, Icon, IconName, RatingPicker } from '@filecab/ui';
import { TitleGenres } from '../title-genres/title-genres';
import { TitleDetails } from '../title-details/title-details';
import type { LibraryCardProps } from './model-library-card';

/** Renders the shared title card with catalog metadata and optional personal state. */
export function LibraryCard({
  entry,
  snapshot: catalogSnapshot,
  actions = [],
  primaryAction,
  showProviderRating = false,
  alert,
  edit,
  remove,
  onGenre,
}: LibraryCardProps) {
  const { t } = useTranslation();
  const changes = useEntryUpdate(entry);
  const titleElement = useRef<HTMLSpanElement>(null);
  const { locale } = useInterfacePreferences();
  const detailsId = useId();
  const [{ failedPoster, details }, { failedPoster: setFailedPoster, details: setDetails }] =
    useLocalStore(() => ({
      failedPoster: null as string | null,
      details: false,
    }));
  const snapshot = entry?.snapshot ?? catalogSnapshot;

  if (!snapshot) return null;

  const title = titleFor(snapshot, locale, t('Untitled'), entry?.userTitle).text;
  const total = snapshot.episodeCount;
  const scores = (catalogSnapshot ?? snapshot).providerRatings
    .filter(
      ({ value, scale }) =>
        Number.isFinite(value) &&
        Number.isFinite(scale) &&
        value > 0 &&
        scale > 0 &&
        value <= scale,
    )
    .map(({ value, scale }) => (value / scale) * 10);
  const providerRating = scores.length
    ? scores.reduce((sum, value) => sum + value, 0) / scores.length
    : 0;
  const rating = showProviderRating ? providerRating : (entry?.rating ?? 0);
  const ratingNumber = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const ratingPrefix = showProviderRating ? '≈ ' : '';
  const ratingText =
    rating > 0 ? `${ratingPrefix}${ratingNumber.format(rating)} / 10` : t('unrated');
  const menuActions = [
    ...(edit ? [{ label: t('Edit'), onClick: edit }] : []),
    ...(remove ? [{ label: t('Delete'), onClick: remove }] : []),
    ...actions,
  ];

  return (
    <li className="library-card local-library__entry">
      <div className="library-card__artwork">
        {snapshot.posterUrl && failedPoster !== snapshot.posterUrl ? (
          <img
            className="library-card__poster"
            src={snapshot.posterUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedPoster(snapshot.posterUrl)}
          />
        ) : (
          <div className="library-card__placeholder">
            <Icon name={IconName.Library} />
            <span className="library-card__placeholder-label">{t('noPoster')}</span>
          </div>
        )}
        {entry?.status && (
          <span className={`library-card__status library-card__status--${entry.status}`}>
            {t(entry.status)}
          </span>
        )}
        {details && (
          <TitleDetails
            id={detailsId}
            snapshot={snapshot}
            comment={entry?.comment ?? ''}
            sources={entry?.sources ?? []}
            onGenre={onGenre}
            onClose={() => setDetails(false)}
          />
        )}
        <div className="library-card__overlay-bar">
          <TitleGenres genres={snapshot.genres} onSelect={onGenre} />
          <button
            type="button"
            className="library-card__details-toggle"
            aria-label={t('details')}
            aria-expanded={details}
            aria-controls={details ? detailsId : undefined}
            onClick={() => setDetails(!details)}
          >
            <span aria-hidden="true">i</span>
          </button>
        </div>
        {menuActions.length > 0 && (
          <details className="library-card__menu">
            <summary className="library-card__menu-trigger" aria-label={t('entryActions')}>
              <Icon name={IconName.More} />
            </summary>
            <div className="library-card__menu-actions">
              {menuActions.map((action, index) => (
                <Button
                  key={index}
                  disabled={action.disabled}
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    action.onClick();
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </details>
        )}
      </div>
      <div className="library-card__body">
        <span
          ref={titleElement}
          className="library-card__title local-library__entry-title"
          title={title}
        >
          {title}
        </span>
        {snapshot.year !== null && <span className="library-card__year">{snapshot.year}</span>}
        {(entry || showProviderRating) && (
          <>
            <div className="library-card__stats">
              {entry && (
                <ProgressControl
                  className="library-card__episodes"
                  value={entry.progress}
                  total={total}
                  disabled={changes.disabled || changes.busy}
                  onChange={(progress) => void changes.update({ progress })}
                />
              )}
              <span
                className={`library-card__rating${rating > 0 ? ' library-card__rating--rated' : ''}`}
                title={showProviderRating ? t('approximateProviderRating') : t('Rating')}
              >
                {entry ? (
                  <RatingPicker
                    anchor={() =>
                      titleElement.current?.closest('.title-results--list')
                        ? null
                        : titleElement.current
                    }
                    value={entry.rating}
                    label={t('Rating')}
                    title={t('yourRating')}
                    clearLabel={t('clearRating')}
                    unratedLabel={t('unrated')}
                    disabled={changes.disabled}
                    busy={changes.busy}
                    error={changes.error}
                    onChange={(rating) => changes.update({ rating })}
                  />
                ) : (
                  <>
                    <span className="library-card__star">
                      <Icon name={rating > 0 ? IconName.Star : IconName.StarOutline} />
                    </span>
                    {ratingText}
                  </>
                )}
              </span>
            </div>
          </>
        )}
        {primaryAction && (
          <Button
            className="library-card__primary-action fc-button--primary"
            disabled={primaryAction.disabled}
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        )}
        {alert && (
          <p className="library-card__alert" role="alert">
            {alert}
          </p>
        )}
      </div>
    </li>
  );
}
