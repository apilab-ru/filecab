import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { AuthReply } from './worker';
import { AuthFailureCode, AuthStage, logAuthStage } from './diagnostics';
import { debugContext } from './connection';

/** Requests account operations without receiving credentials from the privileged worker. */
export function AuthControls() {
  const [state, setState] = useState<AuthReply>({ account: null });
  const [busy, setBusy] = useState(false);
  const run = async (action: string) => {
    setBusy(true);
    try {
      const reply = (await browser.runtime.sendMessage({ action })) as AuthReply | undefined;

      if (!reply) throw new Error('Missing worker response');

      setState(reply);
    } catch {
      const diagnostic = { stage: AuthStage.Messaging, code: AuthFailureCode.WorkerUnavailable };
      logAuthStage(AuthStage.Messaging, 'failed', diagnostic);
      setState({
        account: null,
        error:
          'The extension worker did not reply. Reload the extension and inspect its service worker console.',
        diagnostic,
        debug: debugContext(),
      });
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void run('auth.status');
    const changed = (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'action' in message &&
        message.action === 'auth.changed'
      )
        void run('auth.status');
    };
    browser.runtime.onMessage.addListener(changed);

    return () => browser.runtime.onMessage.removeListener(changed);
  }, []);

  return (
    <div className="auth-controls">
      {state.account ? (
        <>
          <span className="auth-controls__status">Signed in</span>
          <button
            className="auth-controls__button"
            disabled={busy}
            onClick={() => {
              void run('auth.logout');
            }}
          >
            Sign out
          </button>
          <button
            className="auth-controls__button"
            disabled={busy}
            onClick={() => {
              void run('auth.logoutAll');
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
            void run('auth.login');
          }}
        >
          Sign in with Google
        </button>
      )}
      {state.error && (
        <div className="auth-controls__failure">
          <span className="auth-controls__error" role="status">
            {state.error}
          </span>
          {state.diagnostic && (
            <p className="auth-controls__diagnostic">
              Stage: {state.diagnostic.stage} · {state.diagnostic.code}
              {state.diagnostic.status && ` · HTTP ${state.diagnostic.status}`}
              {state.diagnostic.correlationId && ` · Request ${state.diagnostic.correlationId}`}
            </p>
          )}
          {state.debug && (
            <details className="auth-controls__details">
              <summary className="auth-controls__summary">Connection details</summary>
              <dl className="auth-controls__connection">
                <dt className="auth-controls__label">Extension ID</dt>
                <dd className="auth-controls__value">{state.debug.extensionId}</dd>
                <dt className="auth-controls__label">API</dt>
                <dd className="auth-controls__value">{state.debug.apiOrigin}</dd>
                <dt className="auth-controls__label">Allowed origin needed</dt>
                <dd className="auth-controls__value">{state.debug.extensionOrigin}</dd>
                <dt className="auth-controls__label">Extension callback</dt>
                <dd className="auth-controls__value">{state.debug.redirectUrl}</dd>
              </dl>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
