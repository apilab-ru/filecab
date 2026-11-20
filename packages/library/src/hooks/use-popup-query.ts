import { useSearchParams } from 'react-router-dom';

/** Keeps the popup title text in the `q` route parameter, so Page and Search share it. */
export function usePopupQuery(): [string, (query: string) => void] {
  const [params, setParams] = useSearchParams();
  const setQuery = (query: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (query) next.set('q', query);
        else next.delete('q');

        return next;
      },
      { replace: true },
    );

  return [params.get('q') ?? '', setQuery];
}
