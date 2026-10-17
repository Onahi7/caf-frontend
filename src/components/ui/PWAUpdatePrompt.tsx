import { useEffect } from 'react';

/**
 * Activates newly installed service workers so the updated assets are used
 * on the next app launch.
 *
 * Deliberately does NOT force a window.location.reload(): a silent reload can
 * interrupt an in-progress POS checkout or lose unsaved form state. With
 * `clientsClaim` + `skipWaiting` the new worker takes over and serves fresh
 * content the next time the app is opened or navigated to.
 */
export const PWAUpdatePrompt = () => {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;

    let cancelled = false;

    const activateWaitingWorker = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg || cancelled) return;

        // If a new worker is already waiting, activate it for the next launch
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Listen for new workers being installed
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker || cancelled) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW installed while the old one still controls — activate it
              // quietly; it will take effect on the next app launch.
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      } catch {
        // SW not supported or blocked — silently ignore
      }
    };

    void activateWaitingWorker();

    return () => {
      cancelled = true;
    };
  }, []);

  // No UI — updates are applied on next launch without interrupting active work.
  return null;
};
