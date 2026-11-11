import { useTranslation } from 'react-i18next';
import './account-card.scss';

import type { AccountCardProps } from './model-account-card';
import { Button, Icon, IconName } from '@filecab/ui';

/** Presents real sign-in/session actions without inventing unavailable profile fields. */
export function AccountCard({
  signedIn,
  busy,
  signIn,
  signOut,
  signOutAll,
  children,
}: AccountCardProps) {
  const { t } = useTranslation();

  return (
    <div className="auth-controls account-card">
      {signedIn ? (
        <>
          <div className="account-card__identity">
            <span className="account-card__avatar" aria-hidden="true">
              <Icon name={IconName.Check} />
            </span>
            <span className="auth-controls__status">{t('Signed in')}</span>
          </div>
          <div className="account-card__actions">
            <Button className="account-card__sign-out" disabled={busy} onClick={signOut}>
              {t('Sign out')}
            </Button>
            <Button className="account-card__all-sessions" disabled={busy} onClick={signOutAll}>
              {t('Sign out all sessions')}
            </Button>
          </div>
        </>
      ) : (
        <Button
          className="fc-button--primary account-card__google"
          aria-label={t('Sign in with Google')}
          disabled={busy}
          onClick={signIn}
        >
          {t('continueGoogle')}
        </Button>
      )}
      {children}
    </div>
  );
}
