import { useId, useRef } from 'react';
import { useEntryUpdate } from '../../hooks/use-entry-update';
import { ProgressControl } from '../progress-control/progress-control';
import { StatusSelect } from '../status-select/status-select';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useTranslation } from 'react-i18next';
import './library-card.scss';

import { useLocalStore } from '../../hooks/use-local-store';

import { titleFor } from '@filecab/contracts';
import { Button, Icon, IconName, RatingPicker } from '@filecab/ui';
import { TitleGenres } from '../title-genres/title-genres';
import { TitleDetails } from '../title-details/title-details';
import type { LibraryCardProps } from './model-library-card';

const CARD_CONTROL_SELECTOR =
  'button, input, select, textarea, label, summary, a, [role="button"], [role="combobox"], .progress-control__track, .title-details';

/** Renders the shared title card with catalog metadata and optional personal state. */
export function LibraryCard({
  entry,
  snapshot: catalogSnapshot,
  primaryAction,
  showProviderRating = false,
  alert,
  edit,
  remove,
  onGenre,
  readOnly = false,
}: LibraryCardProps) {
  const { t } = useTranslation();
  const changes = useEntryUpdate(entry);
  const titleElement = useRef<HTMLSpanElement>(null);
  const { locale } = useInterfacePreferences();
  const detailsId = useId();
  const detailsToggle = useRef<HTMLButtonElement>(null);
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

  return (
    <li
      className="library-card local-library__entry"
      onClick={(event) => {
        const { target, currentTarget } = event;

        if (
          edit &&
          target instanceof Element &&
          currentTarget.contains(target) &&
          !target.closest(CARD_CONTROL_SELECTOR)
        ) {
          edit();
        }
      }}
      onKeyDown={(event) => {
        if (details && event.key === 'Escape') {
          setDetails(false);
          detailsToggle.current?.focus();
        }
      }}
    >
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
        {entry && readOnly && entry.status && (
          <span className={`library-card__status-text library-card__status-text--${entry.status}`}>
            {t(entry.status)}
          </span>
        )}
        {entry && !readOnly && (
          <StatusSelect
            allowNone
            className="library-card__status"
            value={entry.status}
            disabled={changes.disabled || changes.busy}
            onChange={(status) => void changes.update({ status })}
          />
        )}
        {remove && (
          <Button
            className="library-card__delete"
            aria-label={t('Delete')}
            title={t('Delete')}
            onClick={remove}
          >
            <Icon name={IconName.Trash} />
          </Button>
        )}
      </div>
      <div className="library-card__body">
        <span
          ref={titleElement}
          className="library-card__title local-library__entry-title"
          title={title}
        >
          {edit ? (
            <button
              type="button"
              className="library-card__edit"
              aria-label={t('Edit')}
              aria-description={title}
              onClick={edit}
            >
              {title}
            </button>
          ) : (
            title
          )}
        </span>
        {snapshot.year !== null && <span className="library-card__year">{snapshot.year}</span>}
        {entry && readOnly && (
          <span className="library-card__progress-text">
            {t('Progress')}: {entry.progress}
            {total ? ` / ${total}` : ''}
          </span>
        )}
        {entry && !readOnly && (
          <ProgressControl
            className="library-card__episodes"
            value={entry.progress}
            total={total}
            disabled={changes.disabled || changes.busy}
            onChange={(progress) => void changes.update({ progress })}
          />
        )}
        {(entry || showProviderRating) && (
          <span
            className={`library-card__rating${rating > 0 ? ' library-card__rating--rated' : ''}`}
            title={showProviderRating ? t('approximateProviderRating') : t('Rating')}
          >
            {entry && !readOnly ? (
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
      <div className="library-card__overlay-bar">
        {!details && <TitleGenres genres={snapshot.genres} onSelect={onGenre} />}
        <button
          ref={detailsToggle}
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
      {details && (
        <TitleDetails
          id={detailsId}
          title={title}
          snapshot={snapshot}
          comment={entry?.comment ?? ''}
          sources={entry?.sources ?? []}
          onGenre={onGenre}
        />
      )}
    </li>
  );
}
