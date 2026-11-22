/** Selects the popup-specific sections in the shared settings screen. */
export interface SettingsPageProps {
  popup: boolean;
  /** Opens restore on the full page, because a file picker closes the popup. */
  restoreUrl?: string;
}
