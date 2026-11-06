import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { currentAccount, login, logout } from './session';

/** Provides explicit website login/logout controls without exposing session credentials. */
export function AuthControls() {
  const account = useQuery({
    queryKey: ['account'],
    queryFn: ({ signal }) => currentAccount(signal),
  });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFailure('');
    try {
      await action();
    } catch {
      setFailure('Account service unavailable. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-controls">
      {account.data ? (
        <>
          <span className="auth-controls__status">Signed in</span>
          <button
            className="auth-controls__button"
            disabled={busy}
            onClick={() => {
              void run(() => logout());
            }}
          >
            Sign out
          </button>
          <button
            className="auth-controls__button"
            disabled={busy}
            onClick={() => {
              void run(() => logout(true));
            }}
          >
            Sign out all sessions
          </button>
        </>
      ) : (
        <button
          className="auth-controls__button"
          disabled={busy}
          onClick={() => {
            void run(login);
          }}
        >
          Sign in with Google
        </button>
      )}
      {(failure || account.error) && (
        <span className="auth-controls__error" role="status">
          {failure || 'Account service unavailable. Please retry.'}
        </span>
      )}
    </div>
  );
}
