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
}
