import { useTranslation } from 'react-i18next';
import './auth-controls.scss';

import { Fragment } from 'react';
import { AccountCard } from '../account-card/account-card';
import { useAuth } from '../../hooks/use-auth';

/** Presents shared account actions and consistent localized authentication failures. */
export function AuthControls() {
  const { t } = useTranslation();
  const { account, busy, error, signIn, signOut, signOutAll } = useAuth();

  return (
    <AccountCard
      signedIn={!!account}
      busy={busy}
      signIn={() => void signIn()}
      signOut={() => void signOut()}
      signOutAll={() => void signOutAll()}
    >
      {error && (
        <div className="auth-controls__failure">
          <span className="auth-controls__error" role="status">
            {t(error.message, { defaultValue: error.message })}
          </span>
          {error.diagnostic && (
            <p className="auth-controls__diagnostic">
              {t('Stage:')} {error.diagnostic.stage} · {error.diagnostic.code}
              {error.diagnostic.status && ` · HTTP ${error.diagnostic.status}`}
              {error.diagnostic.correlationId &&
                ` · ${t('Request')} ${error.diagnostic.correlationId}`}
            </p>
          )}
          {!!error.connectionDetails?.length && (
            <details className="auth-controls__details">
              <summary className="auth-controls__summary">{t('Connection details')}</summary>
              <dl className="auth-controls__connection">
                {error.connectionDetails.map(({ label, value }) => (
                  <Fragment key={label}>
                    <dt className="auth-controls__label">{t(label, { defaultValue: label })}</dt>
                    <dd className="auth-controls__value">{value}</dd>
                  </Fragment>
                ))}
              </dl>
            </details>
          )}
        </div>
      )}
    </AccountCard>
  );
}
