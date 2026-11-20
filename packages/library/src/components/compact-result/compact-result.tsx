import { useTranslation } from 'react-i18next';
import { titleFor } from '@filecab/contracts';
import { Icon, IconName } from '@filecab/ui';
import { useWorkspace } from '../../hooks/use-workspace';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { catalogResultState, useCatalogSelect } from '../../hooks/use-catalog-select';
import type { CompactResultProps } from './model-compact-result';
import './compact-result.scss';

/** Shows one catalog result in a row that fits the popup and opens the editor on selection. */
export function CompactResult({ record, link }: CompactResultProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const { state, draft } = useWorkspace();
  const select = useCatalogSelect();
  const { saved, conflict } = catalogResultState(state.rows, record);
  const snapshot = saved?.entry.snapshot ?? record.snapshot;
  const title = titleFor(snapshot, locale, t('Untitled'), saved?.entry.userTitle).text;
  const total = snapshot.episodeCount;
  const number = new Intl.NumberFormat(locale);

  return (
    <li className="compact-result">
      <button
        type="button"
        className="compact-result__button"
        disabled={conflict || Boolean(draft) || !state.repository}
        onClick={() => select(record, link)}
      >
        {snapshot.posterUrl ? (
          <img
            className="compact-result__poster"
            src={snapshot.posterUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="compact-result__poster compact-result__poster--empty">
            <Icon name={IconName.Library} />
          </span>
        )}
        <span className="compact-result__text">
          <span className="compact-result__title" title={title}>
            {title}
          </span>
          <span className="compact-result__meta">
            {snapshot.year !== null && <span>{snapshot.year}</span>}
            {saved?.entry.status && (
              <span className="compact-result__status">{t(saved.entry.status)}</span>
            )}
            {saved && (
              <span>
                {number.format(saved.entry.progress)} /{' '}
                {total === null ? '?' : number.format(total)}
              </span>
            )}
          </span>
          {conflict && (
            <span className="compact-result__alert" role="alert">
              {t('catalogIdentityConflict')}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
