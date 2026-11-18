import type { ApiErrorCode } from './api-error-code';
import type { SyncErrorCode } from './sync-error-code';
import type { SyncOperation } from './sync-operation';
import type { ValidationIssue } from './index';

/** Carries safe synchronization failure metadata without request payloads or credentials. */
export interface SyncDiagnostic {
  code: ApiErrorCode | SyncErrorCode;
  operation?: SyncOperation;
  status?: number;
  correlationId?: string;
  rxdbCode?: string;
  entryId?: string;
  issues?: ValidationIssue[];
}
