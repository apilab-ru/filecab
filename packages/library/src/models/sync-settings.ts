/** Supplies real synchronization state and actions from a client data adapter. */
export interface SyncSettings {
  enabled: boolean;
  working: boolean;
  online: boolean;
  message: string;
  lastSuccess: number | null;
  refresh: () => void;
}
