import { useSyncExternalStore } from 'react';

/** Subscribes to browser connectivity changes. */
function subscribe(changed: () => void) {
  window.addEventListener('online', changed);
  window.addEventListener('offline', changed);

  return () => {
    window.removeEventListener('online', changed);
    window.removeEventListener('offline', changed);
  };
}

/** Reads the current browser connectivity state. */
function snapshot() {
  return navigator.onLine;
}

/** Reports whether the browser is online and re-renders when connectivity changes. */
export function useOnline() {
  return useSyncExternalStore(subscribe, snapshot);
}
