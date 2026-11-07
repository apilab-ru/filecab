import {
  SyncOperation,
  ApiErrorCode,
  SyncErrorCode,
  type SyncDiagnostic,
} from '@filecab/contracts';
import { browser } from 'wxt/browser';
import { SYNC_DIAGNOSTIC_PREFIX } from './sync-diagnostics';

/** Carries safe retry/reset/account failure information without private server payloads. */
export class SyncError extends Error {
  readonly diagnostic: SyncDiagnostic;
  constructor(
    readonly code: ApiErrorCode | SyncErrorCode,
    diagnostic: Omit<SyncDiagnostic, 'code'> = {},
  ) {
    super(SYNC_DIAGNOSTIC_PREFIX + JSON.stringify({ ...diagnostic, code }));
    this.diagnostic = { ...diagnostic, code };
  }
}

/** Sends an allowlisted request through the worker without exposing reusable credentials. */
export async function syncRequest<T>(
  ownerId: string,
  operation: SyncOperation.Snapshot | SyncOperation.Pull | SyncOperation.Push,
  body?: unknown,
): Promise<T> {
  let result:
    { data?: T; error?: ApiErrorCode | SyncErrorCode; diagnostic?: SyncDiagnostic } | undefined;
  try {
    result = (await browser.runtime.sendMessage({
      action: 'sync.request',
      ownerId,
      operation,
      body,
    })) as typeof result;
  } catch {
    throw new SyncError(SyncErrorCode.WorkerUnavailable, { operation: SyncOperation.Messaging });
  }

  if (!result || result.error)
    throw new SyncError(result?.error ?? SyncErrorCode.WorkerUnavailable, result?.diagnostic);

  return result.data as T;
}
