import { expect, test } from 'vitest';
import { syncDiagnostic, SYNC_DIAGNOSTIC_PREFIX } from './sync-diagnostics';

const requestId = '10000000-0000-4000-8000-000000000001';

test('RxDB wrappers retain the specific request failure and discard private error content', () => {
  const error = {
    code: 'RC_PUSH',
    message: 'private document and token',
    parameters: {
      errors: [
        {
          diagnostic: {
            code: 'VALIDATION_ERROR',
            operation: 'push',
            status: 400,
            correlationId: requestId,
            body: 'private body',
          },
        },
      ],
      writeRows: ['private row'],
    },
  };
  expect(syncDiagnostic(error)).toEqual({
    code: 'VALIDATION_ERROR',
    operation: 'push',
    status: 400,
    correlationId: requestId,
    rxdbCode: 'RC_PUSH',
  });
  expect(JSON.stringify(syncDiagnostic(error))).not.toContain('private');
});

test('unsafe codes, request identifiers and arbitrary error messages are never diagnostics', () => {
  expect(syncDiagnostic({ code: 'private token', message: 'private title' })).toEqual({
    code: 'REPLICATION_ERROR',
  });
  expect(
    syncDiagnostic({
      diagnostic: {
        code: 'NETWORK_ERROR',
        correlationId: 'private title',
        operation: 'private url',
        status: 'private token',
      },
    }),
  ).toEqual({ code: 'NETWORK_ERROR' });
  expect(
    syncDiagnostic({
      code: 'VD2',
      parameters: { errors: [{ message: 'private invalid record' }] },
    }),
  ).toEqual({ code: 'REPLICATION_ERROR', rxdbCode: 'VD2' });
});

test('serialized RxDB errors retain safe diagnostics after custom Error properties are stripped', () => {
  const diagnostic = {
    code: 'FORBIDDEN',
    operation: 'pull',
    status: 403,
    correlationId: requestId,
  };
  expect(
    syncDiagnostic({
      code: 'RC_PULL',
      parameters: {
        errors: [
          { code: 'FORBIDDEN', message: SYNC_DIAGNOSTIC_PREFIX + JSON.stringify(diagnostic) },
        ],
      },
    }),
  ).toEqual({ ...diagnostic, rxdbCode: 'RC_PULL' });
  expect(syncDiagnostic({ message: SYNC_DIAGNOSTIC_PREFIX + 'not JSON' })).toEqual({
    code: 'REPLICATION_ERROR',
  });
});
