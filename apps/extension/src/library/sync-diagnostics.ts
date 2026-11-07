import {
  SyncOperation,
  ApiErrorCode,
  SyncErrorCode,
  type SyncDiagnostic,
} from '@filecab/contracts';

export const SYNC_DIAGNOSTIC_PREFIX = 'FILECAB_SYNC_DIAGNOSTIC:';

const FAILURE_CODES = new Set<string>([
  ...Object.values(ApiErrorCode),
  ...Object.values(SyncErrorCode),
]);

/** Extracts safe metadata from RxDB wrappers while discarding error messages and document payloads. */
export function syncDiagnostic(error: unknown, depth = 0): SyncDiagnostic {
  const fallback: SyncDiagnostic = { code: SyncErrorCode.ReplicationError };

  if (!error || typeof error !== 'object' || depth > 4) return fallback;

  const input = error as {
    code?: unknown;
    message?: unknown;
    diagnostic?: unknown;
    parameters?: { errors?: unknown[]; error?: unknown };
  };
  const rxdbCode =
    typeof input.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(input.code)
      ? input.code
      : undefined;

  // RxDB serializes errors and drops custom properties, but retains message/code.
  // Decode only our bounded diagnostic envelope, then apply the same allowlist.
  if (
    !input.diagnostic &&
    typeof input.message === 'string' &&
    input.message.length <= 1024 &&
    input.message.startsWith(SYNC_DIAGNOSTIC_PREFIX)
  ) {
    try {
      return syncDiagnostic(
        { diagnostic: JSON.parse(input.message.slice(SYNC_DIAGNOSTIC_PREFIX.length)) },
        depth + 1,
      );
    } catch {
      return fallback;
    }
  }

  const diagnostic = input.diagnostic as Partial<SyncDiagnostic> | undefined;

  if (diagnostic && FAILURE_CODES.has(String(diagnostic.code))) {
    return {
      code: diagnostic.code!,
      ...(Object.values(SyncOperation).includes(diagnostic.operation!)
        ? { operation: diagnostic.operation }
        : {}),
      ...(Number.isInteger(diagnostic.status) &&
      diagnostic.status! >= 100 &&
      diagnostic.status! <= 599
        ? { status: diagnostic.status }
        : {}),
      ...(typeof diagnostic.correlationId === 'string' &&
      /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(diagnostic.correlationId)
        ? { correlationId: diagnostic.correlationId }
        : {}),
    };
  }

  const nested = input.parameters?.errors?.[0] ?? input.parameters?.error;

  if (nested) {
    const cause = syncDiagnostic(nested, depth + 1);

    return { ...cause, ...(rxdbCode ? { rxdbCode } : {}) };
  }

  return FAILURE_CODES.has(String(input.code))
    ? { code: input.code as ApiErrorCode | SyncErrorCode }
    : { ...fallback, ...(rxdbCode ? { rxdbCode } : {}) };
}
