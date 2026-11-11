import type { AuthRepository, AuthState } from '@filecab/library';
import { QueryObserver } from '@tanstack/react-query';
import { currentAccount, login, logout, queryClient } from './session';

const SERVICE_ERROR = 'Account service unavailable. Please retry.';

/** Adapts the shared account query and cookie-session operations for shared controls. */
export class WebsiteAuthRepository implements AuthRepository {
  private readonly observer = new QueryObserver(queryClient, {
    queryKey: ['account'],
    queryFn: ({ signal }) => currentAccount(signal),
  });

  private readonly listeners = new Set<() => void>();

  private unsubscribeAccount?: () => void;

  private failure = '';

  private state: AuthState = {
    account: this.observer.getCurrentResult().data ?? null,
    busy: false,
    error: null,
  };

  getSnapshot = (): AuthState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    if (this.listeners.size === 1) {
      this.unsubscribeAccount = this.observer.subscribe(() => this.update());
      this.update();
    }

    return () => {
      this.listeners.delete(listener);

      if (!this.listeners.size) {
        this.unsubscribeAccount?.();
        this.unsubscribeAccount = undefined;
      }
    };
  };

  signIn = (): Promise<void> => this.run(login);

  signOut = (): Promise<void> => this.run(() => logout());

  signOutAll = (): Promise<void> => this.run(() => logout(true));

  private update(): void {
    const result = this.observer.getCurrentResult();
    const message = this.failure || (result.error ? SERVICE_ERROR : '');
    this.state = {
      ...this.state,
      account: result.data ?? null,
      error: message ? { message } : null,
    };
    this.listeners.forEach((listener) => listener());
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.state = { ...this.state, busy: true };
    this.failure = '';
    this.update();
    try {
      await action();
    } catch {
      this.failure = SERVICE_ERROR;
    } finally {
      this.state = { ...this.state, busy: false };
      this.update();
    }
  }
}

export const authRepository = new WebsiteAuthRepository();
