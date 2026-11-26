/** Contains operational provider failure details without request content or credentials. */
export interface ProviderDiagnostic {
  provider: string;
  origin: string;
  operation: 'search' | 'discovery' | 'details';
  stage: 'transport' | 'http' | 'body' | 'json' | 'schema';
  elapsedMs: number;
  upstreamStatus?: number;
  networkCode?: string;
  validationFields?: string[];
  /**
   * A trimmed JSON copy of the rejected part of a provider response: the first invalid item of
   * `docs`, else the start of the response. Only schema failures have it.
   */
  responseExcerpt?: string;
}
