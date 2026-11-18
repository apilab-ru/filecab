/** Defines one configurable browser filter. */
export interface BrowserFilter {
  key: string;
  label: string;
  value: string | null;
  disabled?: boolean;
  options?: { value: string | null; label: string }[];
  onChange: (value: string | null) => void;
}

/** Configures the shared search and filter toolbar. */
export interface BrowserFiltersProps {
  query: string;
  queryLabel: string;
  onQueryChange: (value: string) => void;
  filters: BrowserFilter[];
  disabled?: boolean;
  onAdd?: () => void;
}
