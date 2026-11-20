import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeSourceUrl, Status, titleFor } from '@filecab/contracts';
import { Button, Icon, IconName, RatingPicker, Select } from '@filecab/ui';
import { catalogResultState, useCatalogSelect } from '../../hooks/use-catalog-select';
import { useEntryUpdate } from '../../hooks/use-entry-update';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useWorkspace } from '../../hooks/use-workspace';
import type { PopupCardProps } from './model-popup-card';
import './popup-card.scss';

/**
 * Shows one title in the popup. A saved entry changes status, rating and progress directly.
 * An unsaved catalog result offers Add, which opens the editor. On the Page tab, a click on a saved
 * card links the page to that entry.
 */
export function PopupCard({ record, row: givenRow, link, onPick }: PopupCardProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const { state, draft, open } = useWorkspace();
  const select = useCatalogSelect();
  const { saved, conflict } = record
    ? catalogResultState(state.rows, record)
    : { saved: undefined, conflict: false };
  const row = givenRow ?? saved;
  const entry = row?.entry;
  const changes = useEntryUpdate(entry);
  const [progressText, setProgressText] = useState(String(entry?.progress ?? 0));
  const [failedPoster, setFailedPoster] = useState<string | null>(null);

  useEffect(() => setProgressText(String(entry?.progress ?? 0)), [entry?.progress]);

  const snapshot = entry?.snapshot ?? record?.snapshot;

  if (!snapshot) return null;

  const title = titleFor(snapshot, locale, t('Untitled'), entry?.userTitle).text;
  const total = snapshot.episodeCount;
  const number = new Intl.NumberFormat(locale);
  const progress = entry?.progress ?? 0;
  const filled = total && total > 0 ? Math.min(100, (progress / total) * 100) : 0;
  const pageLink = link ? normalizeSourceUrl(link) : null;
  const linked = Boolean(
    pageLink && entry?.sources.some((source) => source.normalizedUrl === pageLink),
  );
  const blocked = conflict || Boolean(draft) || !state.repository;
  // On the Page tab, a click on a saved card that does not hold the page link links the page to
  // it. The save removes the link from the entry that held it. Other clicks open the editor.
  const linksPage = Boolean(link && entry && !linked);
  const pick = () => {
    onPick?.();

    if (linksPage && link) void changes.update({ sourceUrls: [link] });
    else if (record) select(record, link);
    else if (row) open(row.entry.category, row, undefined, undefined, link ? { link } : undefined);
  };
  const pickTitle = linksPage ? t('linkToPage') : undefined;
  const setProgress = (value: number) => {
    if (!Number.isInteger(value) || value < 0) {
      setProgressText(String(progress));

      return;
    }

    if (value !== progress) void changes.update({ progress: value });
  };

  return (
    <li className="popup-card">
      <button
        type="button"
        className="popup-card__poster-button"
        // The title button carries the same action for keyboard and screen reader users.
        tabIndex={-1}
        aria-hidden="true"
        disabled={blocked || changes.busy}
        title={pickTitle}
        onClick={pick}
      >
        {snapshot.posterUrl && failedPoster !== snapshot.posterUrl ? (
          <img
            className="popup-card__poster"
            src={snapshot.posterUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedPoster(snapshot.posterUrl)}
          />
        ) : (
          <span className="popup-card__poster popup-card__poster--empty">
            <Icon name={IconName.Library} />
          </span>
        )}
      </button>
      <div className="popup-card__body">
        <div className="popup-card__heading">
          <button
            type="button"
            className="popup-card__title local-library__entry-title"
            title={pickTitle ?? title}
            disabled={blocked || changes.busy}
            onClick={pick}
          >
            {title}
          </button>
          {linked && (
            <span className="popup-card__linked" role="img" aria-label={t('pageLinked')}>
              <Icon name={IconName.Link} />
            </span>
          )}
        </div>
        {snapshot.year !== null && <span className="popup-card__year">{snapshot.year}</span>}
        {entry ? (
          <>
            <div className="popup-card__row">
              <Select<Status | null>
                aria-label={t('Status')}
                className={`popup-card__status popup-card__status--${entry.status ?? 'none'}`}
                disabled={changes.disabled || changes.busy}
                value={entry.status}
                placeholder={t('Status')}
                options={Object.values(Status).map((value) => ({ value, label: t(value) }))}
                onValueChange={(status) => {
                  if (status !== entry.status) void changes.update({ status });
                }}
              />
              <span className="popup-card__rating">
                <RatingPicker
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
              </span>
            </div>
            <div className="popup-card__progress">
              <Button
                className="popup-card__step"
                aria-label={t('progressDecrease')}
                disabled={changes.disabled || changes.busy || progress <= 0}
                onClick={() => setProgress(progress - 1)}
              >
                <Icon name={IconName.Minus} />
              </Button>
              <input
                className="popup-card__count"
                aria-label={t('Progress')}
                inputMode="numeric"
                value={progressText}
                disabled={changes.disabled || changes.busy}
                onChange={(event) => setProgressText(event.target.value.replace(/\D/g, ''))}
                onBlur={() => setProgress(progressText === '' ? NaN : Number(progressText))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
              <span className="popup-card__total">
                / {total === null ? '?' : number.format(total)}
              </span>
              <Button
                className="popup-card__step"
                aria-label={t('progressIncrease')}
                disabled={changes.disabled || changes.busy}
                onClick={() => setProgress(progress + 1)}
              >
                <Icon name={IconName.Plus} />
              </Button>
            </div>
            <div className="popup-card__track" aria-hidden="true">
              <div className="popup-card__fill" style={{ width: `${filled}%` }} />
            </div>
            {changes.error && (
              <span className="popup-card__alert" role="alert">
                {changes.error}
              </span>
            )}
          </>
        ) : (
          <>
            {total !== null && (
              <span className="popup-card__year">
                {t('episodes')}: {number.format(total)}
              </span>
            )}
            <Button
              className="popup-card__add fc-button--primary"
              disabled={blocked}
              onClick={pick}
            >
              <Icon name={IconName.Plus} />
              {t('addTitle')}
            </Button>
          </>
        )}
        {conflict && (
          <span className="popup-card__alert" role="alert">
            {t('catalogIdentityConflict')}
          </span>
        )}
      </div>
    </li>
  );
}
