import type { ApiErrorCode, SyncErrorCode, SyncDiagnostic } from '@filecab/contracts';

/** Describes the current surface's network state; pending changes remain in native RxDB metadata. */
export interface SyncStatus {
  phase: 'syncing' | 'idle' | 'failed' | 'reset-required';
  error?: ApiErrorCode | SyncErrorCode;
  diagnostic?: SyncDiagnostic;
}
