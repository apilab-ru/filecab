import type { ErrorEvent } from '@sentry/nestjs';

/** Removes private request and exception content before a Sentry event leaves the API. */
export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  const safeMessage =
    typeof event.contexts?.api_error?.message === 'string'
      ? event.contexts.api_error.message
      : 'Unhandled API error';
  const apiRequest = event.contexts?.api_request;
  event.request =
    typeof apiRequest?.method === 'string' && typeof apiRequest?.route === 'string'
      ? { method: apiRequest.method, url: apiRequest.route }
      : undefined;
  event.user = undefined;
  event.extra = undefined;
  event.breadcrumbs = [];
  event.transaction = undefined;
  event.contexts = {
    runtime: event.contexts?.runtime,
    api_error: event.contexts?.api_error,
    api_request: apiRequest,
    provider_failure: event.contexts?.provider_failure,
  };
  event.message = safeMessage;
  event.logentry = undefined;

  if (event.exception?.values)
    event.exception.values = event.exception.values.map((exception) => ({
      ...exception,
      value: safeMessage,
    }));

  return event;
}
