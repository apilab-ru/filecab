import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  currentAccount: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('./session', async () => {
  const { QueryClient } = await import('@tanstack/react-query');

  return {
    ...actions,
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }),
  };
});

import { WebsiteAuthRepository } from './auth-repository';
import { queryClient } from './session';

const cleanups: (() => void)[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  actions.currentAccount.mockResolvedValue({ schemaVersion: 1, ownerId: 'first-owner' });
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  queryClient.clear();
});

test('observes existing account-cache updates and detaches after the last subscriber', async () => {
  const repository = new WebsiteAuthRepository();
  const listener = vi.fn();
  const unsubscribe = repository.subscribe(listener);
  cleanups.push(unsubscribe);
  await vi.waitFor(() => expect(repository.getSnapshot().account?.ownerId).toBe('first-owner'));
  queryClient.setQueryData(['account'], { schemaVersion: 1, ownerId: 'other-tab-owner' });
  await vi.waitFor(() => expect(repository.getSnapshot().account?.ownerId).toBe('other-tab-owner'));
  queryClient.setQueryData(['account'], null);
  await vi.waitFor(() => expect(repository.getSnapshot().account).toBeNull());
  unsubscribe();
  listener.mockClear();
  queryClient.setQueryData(['account'], { schemaVersion: 1, ownerId: 'detached-owner' });
  expect(listener).not.toHaveBeenCalled();
});

test('reports query and action errors through the same safe error model and recovers', async () => {
  actions.currentAccount.mockRejectedValue(new Error('private server payload'));
  const repository = new WebsiteAuthRepository();
  cleanups.push(repository.subscribe(() => {}));
  const error = { message: 'Account service unavailable. Please retry.' };
  await vi.waitFor(() => expect(repository.getSnapshot().error).toEqual(error));
  actions.currentAccount.mockResolvedValue(null);
  await queryClient.refetchQueries({ queryKey: ['account'] });
  expect(repository.getSnapshot().error).toBeNull();
  actions.login.mockRejectedValue(new Error('private login failure'));
  await repository.signIn();
  expect(repository.getSnapshot()).toMatchObject({ busy: false, error });
  actions.logout.mockResolvedValue(undefined);
  await repository.signOut();
  expect(actions.logout).toHaveBeenCalledWith();
  expect(repository.getSnapshot().error).toBeNull();
});

test('keeps controls busy until sign-out-all completes and reuses its existing session action', async () => {
  const repository = new WebsiteAuthRepository();
  cleanups.push(repository.subscribe(() => {}));
  await vi.waitFor(() => expect(repository.getSnapshot().account?.ownerId).toBe('first-owner'));
  let complete!: () => void;
  actions.logout.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const pending = repository.signOutAll();
  expect(repository.getSnapshot().busy).toBe(true);
  expect(actions.logout).toHaveBeenCalledWith(true);
  complete();
  await pending;
  expect(repository.getSnapshot().busy).toBe(false);
});
