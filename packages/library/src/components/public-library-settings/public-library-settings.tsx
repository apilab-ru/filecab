import './public-library-settings.scss';

import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@filecab/ui';
import { SyncErrorCode } from '@filecab/contracts';
import {
  UsernameInvalidError,
  UsernameReadError,
  UsernameTakenError,
} from '../../models/public-library';
import {
  PUBLIC_LIBRARY_ERRORS,
  type PublicLibraryNotice,
  type PublicLibrarySettingsProps,
} from './model-public-library-settings';

/** Sets the username that makes the account library public. An empty username turns it off. */
export function PublicLibrarySettings({ ownerId, repository }: PublicLibrarySettingsProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const noticeId = useId();
  const [username, setUsername] = useState<string | null>();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<PublicLibraryNotice>('');
  const [readAttempt, setReadAttempt] = useState(0);
  const [readError, setReadError] = useState<UsernameReadError | null>(null);

  useEffect(() => {
    let active = true;
    setUsername(undefined);
    setNotice('');
    setReadError(null);

    repository
      .read(ownerId)
      .then((value) => {
        if (!active) return;

        setUsername(value);
        setInput(value ?? '');
      })
      .catch((error: unknown) => {
        if (active)
          setReadError(error instanceof UsernameReadError ? error : new UsernameReadError({}));
      });

    return () => {
      active = false;
    };
  }, [ownerId, repository, readAttempt]);

  const diagnostic = readError?.diagnostic;
  const details = [
    diagnostic?.code,
    diagnostic?.status && `HTTP ${diagnostic.status}`,
    diagnostic?.correlationId && `${t('Request')} ${diagnostic.correlationId}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const save = async () => {
    if (username === undefined || busy) return;

    setBusy(true);
    setNotice('');
    try {
      const saved = await repository.save(input.trim(), ownerId);
      setUsername(saved);
      setInput(saved ?? '');
      setNotice(saved ? 'publicLibraryOn' : 'publicLibraryOff');
    } catch (error) {
      if (error instanceof UsernameTakenError) setNotice('usernameTaken');
      else if (error instanceof UsernameInvalidError) setNotice('usernameInvalid');
      else setNotice('publicLibrarySaveFailed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="public-library-settings"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <p className="public-library-settings__message" id={noticeId}>
        {t('publicLibraryPrivacy')}
      </p>
      <label className="public-library-settings__label" htmlFor={inputId}>
        {t('username')}
      </label>
      <div className="public-library-settings__row">
        <input
          id={inputId}
          className="public-library-settings__input"
          value={input}
          maxLength={32}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={noticeId}
          disabled={username === undefined || busy}
          onChange={(event) => setInput(event.target.value)}
        />
        <Button
          type="submit"
          className="fc-button--primary public-library-settings__save"
          disabled={username === undefined || busy}
        >
          {t('save')}
        </Button>
      </div>
      {username && (
        <p className="public-library-settings__address">
          {t('publicLibraryAddress')}{' '}
          <a
            className="public-library-settings__link"
            href={repository.address(username)}
            target="_blank"
            rel="noreferrer"
          >
            {repository.address(username)}
          </a>
        </p>
      )}
      {notice && (
        <p
          className="public-library-settings__notice"
          role={PUBLIC_LIBRARY_ERRORS.has(notice) ? 'alert' : 'status'}
        >
          {t(notice)}
        </p>
      )}
      {readError && (
        <div className="public-library-settings__read-error">
          <p className="public-library-settings__notice" role="alert">
            {t(
              diagnostic?.code === SyncErrorCode.InvalidRequest
                ? 'publicLibraryWorkerOutdated'
                : 'publicLibraryReadFailed',
            )}
            {details && <span className="public-library-settings__diagnostic">{details}</span>}
          </p>
          <Button type="button" onClick={() => setReadAttempt((attempt) => attempt + 1)}>
            {t('retry')}
          </Button>
        </div>
      )}
    </form>
  );
}
