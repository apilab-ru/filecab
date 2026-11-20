import { useEffect, useRef } from 'react';
import type {
  CatalogCapabilities,
  CatalogSearchRequest,
  CatalogSearchResponse,
} from '@filecab/contracts';
import { catalogCapabilities, catalogSearch } from '../domain/catalog-client';
import { useLocalStore } from './use-local-store';

/** Debounces catalog reads and rejects stale completions even when the transport ignores abort. */
export function useCatalogSearch(
  origin: string,
  request: CatalogSearchRequest,
  retry: number,
  enabled = true,
) {
  const [state, setters] = useLocalStore(() => ({
    capabilities: null as CatalogCapabilities | null,
    capabilityError: false,
    result: null as { key: string; response: CatalogSearchResponse } | null,
    error: '',
  }));
  const key = JSON.stringify(request);
  const latest = useRef(key);
  latest.current = key;
  useEffect(() => {
    const controller = new AbortController();
    setters.capabilityError(false);
    void catalogCapabilities(origin, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setters.capabilities(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setters.capabilityError(true);
      });

    return () => controller.abort();
  }, [origin, retry]);
  const selectedProvider = request.provider ?? state.capabilities?.defaults[request.category];
  const capability = state.capabilities?.providers.find(
    (provider) =>
      provider.provider === selectedProvider && provider.categories.includes(request.category),
  );
  const canSearch = Boolean(
    enabled &&
    capability?.operations.includes('search') &&
    (request.query.trim() || capability.browse),
  );
  useEffect(() => {
    const controller = new AbortController();
    setters.error('');
    setters.result(null);

    if (!canSearch) return;

    const timer = setTimeout(() => {
      void catalogSearch(origin, request, controller.signal)
        .then((response) => {
          if (!controller.signal.aborted && latest.current === key)
            setters.result({ key, response });
        })
        .catch(() => {
          if (!controller.signal.aborted && latest.current === key) setters.error(key);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [origin, key, canSearch, retry]);
  const result = state.result?.key === key && !state.error ? state.result.response : null;

  return {
    capabilities: state.capabilities,
    capability,
    capabilityError: state.capabilityError,
    canSearch,
    result,
    failed: state.error === key,
    loading: canSearch && !result && state.error !== key,
  };
}
