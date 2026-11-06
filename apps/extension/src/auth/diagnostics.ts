export enum AuthStage {
  Storage = 'storage',
  Configuration = 'configuration',
  BrowserLogin = 'browser-login',
  Callback = 'callback',
  Exchange = 'exchange',
  Refresh = 'refresh',
  Account = 'account',
  Logout = 'logout',
  Messaging = 'messaging',
}

export enum AuthFailureCode {
  StorageUnavailable = 'STORAGE_UNAVAILABLE',
  ApiUnreachable = 'API_UNREACHABLE',
  ExtensionNotAllowed = 'EXTENSION_NOT_ALLOWED',
  GoogleDisabled = 'GOOGLE_DISABLED',
  BrowserLoginFailed = 'BROWSER_LOGIN_FAILED',
  LoginCancelled = 'LOGIN_CANCELLED',
  CallbackMismatch = 'CALLBACK_MISMATCH',
  HttpRejected = 'HTTP_REJECTED',
  ApiOutdated = 'API_OUTDATED',
  SessionRejected = 'SESSION_REJECTED',
  WorkerUnavailable = 'WORKER_UNAVAILABLE',
}

const FAILURE_MESSAGES: Record<AuthFailureCode, string> = {
  STORAGE_UNAVAILABLE:
    'Extension credential storage is unavailable. Check identity/storage permissions and reload the extension.',
  API_UNREACHABLE:
    'Cannot reach the API. Check that it is running and that the extension has permission for the API origin.',
  EXTENSION_NOT_ALLOWED:
    'Add this extension origin to API EXTENSION_ORIGINS, then restart the API.',
  GOOGLE_DISABLED: 'Google login is disabled in the API configuration.',
  BROWSER_LOGIN_FAILED:
    'The browser login window failed. Check the service worker console and the API login configuration.',
  LOGIN_CANCELLED: 'Google sign-in was cancelled. Start sign-in again when ready.',
  CALLBACK_MISMATCH:
    'The login callback did not match this attempt. Reload the extension and start a new sign-in.',
  HTTP_REJECTED:
    'The API rejected this operation. Use the stage, HTTP status and request ID to inspect the API log.',
  API_OUTDATED: 'The API login endpoint is unavailable. Restart the API with the current code.',
  SESSION_REJECTED: 'The session or login code expired or was rejected. Start a new sign-in.',
  WORKER_UNAVAILABLE:
    'The extension worker did not reply. Inspect its service worker console, reload the extension and reopen this page.',
};

const DEFAULT_FAILURES: Record<AuthStage, AuthFailureCode> = {
  storage: AuthFailureCode.StorageUnavailable,
  configuration: AuthFailureCode.ApiUnreachable,
  'browser-login': AuthFailureCode.BrowserLoginFailed,
  callback: AuthFailureCode.CallbackMismatch,
  exchange: AuthFailureCode.HttpRejected,
  refresh: AuthFailureCode.HttpRejected,
  account: AuthFailureCode.HttpRejected,
  logout: AuthFailureCode.HttpRejected,
  messaging: AuthFailureCode.WorkerUnavailable,
};

/** Contains only bounded, allowlisted debugging fields safe for console and UI display. */
export interface AuthDiagnostic {
  stage: AuthStage;
  code: AuthFailureCode;
  status?: number;
  correlationId?: string;
}

/** Carries static guidance without retaining raw browser/server exception details. */
export class AuthFailure extends Error {
  constructor(readonly diagnostic: AuthDiagnostic) {
    super(FAILURE_MESSAGES[diagnostic.code]);
  }
}

/** Emits only static stage/outcome labels and safe diagnostic metadata. */
export function logAuthStage(
  stage: AuthStage,
  outcome: 'started' | 'ok' | 'failed',
  diagnostic?: AuthDiagnostic,
): void {
  console.info('[Filecab auth]', { stage, outcome, ...diagnostic });
}

/** Annotates an authentication boundary without printing credentials or raw errors. */
export async function authStep<T>(stage: AuthStage, action: () => Promise<T>): Promise<T> {
  logAuthStage(stage, 'started');
  try {
    const result = await action();
    logAuthStage(stage, 'ok');

    return result;
  } catch (error) {
    const failure =
      error instanceof AuthFailure
        ? error
        : new AuthFailure({ stage, code: DEFAULT_FAILURES[stage] });
    logAuthStage(failure.diagnostic.stage, 'failed', failure.diagnostic);

    throw failure;
  }
}
