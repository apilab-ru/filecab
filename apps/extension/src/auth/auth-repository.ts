import type { AuthError, AuthRepository, AuthState } from '@filecab/library';
import { browser } from 'wxt/browser';
import type { AuthReply } from './worker';
import { AuthFailureCode, AuthStage, logAuthStage } from './diagnostics';
import { debugContext } from './connection';

/** Maps safe worker failures into the shared error-reporting contract. */
function authError(reply: AuthReply): AuthError | null {
  if (!reply.error) return null;

  const debug = reply.debug;

  return {
    message: reply.error,
    diagnostic: reply.diagnostic,
    connectionDetails: debug
      ? [
          { label: 'Extension ID', value: debug.extensionId },
          { label: 'API', value: debug.apiOrigin },
          { label: 'Allowed origin needed', value: debug.extensionOrigin },
          { label: 'Extension callback', value: debug.redirectUrl },
        ]
      : undefined,
  };
}

/** Keeps privileged authentication in the worker and exposes only safe observable state. */
export class ExtensionAuthRepository implements AuthRepository {
  private readonly listeners = new Set<() => void>();

  private state: AuthState = { account: null, busy: false, error: null };

  getSnapshot = (): AuthState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    if (this.listeners.size === 1) {
      browser.runtime.onMessage.addListener(this.changed);
      void this.run('auth.status');
    }

    return () => {
      this.listeners.delete(listener);

      if (!this.listeners.size) browser.runtime.onMessage.removeListener(this.changed);
    };
  };

  signIn = (): Promise<void> => this.run('auth.login');

  signOut = (): Promise<void> => this.run('auth.logout');

  signOutAll = (): Promise<void> => this.run('auth.logoutAll');

  private changed = (message: unknown): void => {
    if (
      typeof message === 'object' &&
      message !== null &&
      'action' in message &&
      message.action === 'auth.changed'
    )
      void this.run('auth.status');
  };

  private update(state: AuthState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  private async run(action: string): Promise<void> {
    this.update({ ...this.state, busy: true });
    try {
      const reply = (await browser.runtime.sendMessage({ action })) as AuthReply | undefined;

      if (!reply) throw new Error('Missing worker response');

      this.update({ account: reply.account, busy: true, error: authError(reply) });
    } catch {
      const diagnostic = { stage: AuthStage.Messaging, code: AuthFailureCode.WorkerUnavailable };
      logAuthStage(AuthStage.Messaging, 'failed', diagnostic);
      this.update({
        account: null,
        busy: true,
        error: authError({
          account: null,
          error:
            'The extension worker did not reply. Reload the extension and inspect its service worker console.',
          diagnostic,
          debug: debugContext(),
        }),
      });
    } finally {
      this.update({ ...this.state, busy: false });
    }
  }
}

export const authRepository = new ExtensionAuthRepository();
