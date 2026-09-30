import { useEffect, useRef } from 'react';
import { playScanBeep } from '../utils/scan-sound';

interface HardwareScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minChars?: number;
  maxIntervalMs?: number;
}

/**
 * Listens for keystrokes from physical USB, Bluetooth, or wireless 2.4GHz barcode scanners.
 * Hardware scanners send a stream of rapid characters ending with 'Enter'.
 */
export function useHardwareBarcodeScanner({
  onScan,
  enabled = true,
  minChars = 4,
  maxIntervalMs = 50,
}: HardwareScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = performance.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Check if user is typing in a non-search form input
      const target = e.target as HTMLElement | null;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      const isSearchInput = isInput && (target as HTMLInputElement)?.dataset?.isSearch === 'true';

      if (e.key === 'Enter') {
        const candidate = bufferRef.current.trim();
        bufferRef.current = '';

        if (candidate.length >= minChars) {
          // Hardware scanner completed scan
          if (isInput && !isSearchInput) {
            // If a specific input like the barcode field has focus, let the input receive the value
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          playScanBeep(true);
          onScanRef.current(candidate);
        }
        return;
      }

      // Ignore modifiers and control keys
      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      // If the interval between characters is greater than maxIntervalMs, reset buffer
      if (interval > maxIntervalMs) {
        bufferRef.current = e.key;
      } else {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, minChars, maxIntervalMs]);
}
