import { useSyncExternalStore } from 'react';

function subscribe(onStoreChange) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

function getServerSnapshot() {
  return true;
}

function getClientSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Tracks navigator.onLine for offline banners and conditional refresh.
 */
export function useOnline() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
