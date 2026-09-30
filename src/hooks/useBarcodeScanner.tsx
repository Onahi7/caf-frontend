import { useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { CameraScannerModal } from '../components/common/CameraScannerModal';

type ScanListener = { remove: () => Promise<void> };

/**
 * Lazy-loads the ML Kit barcode scanner only on native platforms.
 */
async function getNativeScanner() {
  if (!Capacitor.isNativePlatform()) return null;
  const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
  return BarcodeScanner;
}

/**
 * Standard Barcode Scanner Hook.
 * Supports:
 * 1. Native mobile (Android/iOS) via Google ML Kit
 * 2. Web browsers (Chrome, Edge, Safari, mobile web) via HTML5 Camera & BarcodeDetector
 * 3. Countertop USB / Bluetooth physical barcode guns
 */
export function useBarcodeScanner() {
  const listenerRef = useRef<ScanListener | null>(null);
  const nativeScanningRef = useRef(false);

  // Web camera modal state
  const [isWebModalOpen, setIsWebModalOpen] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const scanResolverRef = useRef<((value: string | null) => void) | null>(null);
  const continuousCallbackRef = useRef<((value: string) => void) | null>(null);

  // Available on native Capacitor OR any browser supporting navigator.mediaDevices
  const isAvailable =
    Capacitor.isNativePlatform() ||
    (typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);

  const requestNativePermission = async (): Promise<boolean> => {
    const scanner = await getNativeScanner();
    if (!scanner) return false;
    const { camera } = await scanner.requestPermissions();
    return camera === 'granted' || camera === 'limited';
  };

  /**
   * Scans a single barcode.
   * On native: opens ML Kit scanner UI.
   * On web: opens CameraScannerModal, waits for 1 scan, and returns the result.
   */
  const scanOnce = useCallback(async (): Promise<string | null> => {
    if (Capacitor.isNativePlatform()) {
      const scanner = await getNativeScanner();
      if (!scanner) return null;

      const ok = await requestNativePermission();
      if (!ok) return null;

      try {
        const { barcodes } = await scanner.scan();
        return barcodes[0]?.rawValue ?? null;
      } catch {
        return null;
      }
    }

    // Web fallback: open CameraScannerModal in single mode
    return new Promise<string | null>((resolve) => {
      scanResolverRef.current = resolve;
      setIsContinuous(false);
      setIsWebModalOpen(true);
    });
  }, []);

  /**
   * Starts a continuous scan (e.g. for rapid POS checkout).
   */
  const startContinuousScan = useCallback(
    async (onScan: (value: string) => void) => {
      if (Capacitor.isNativePlatform()) {
        if (nativeScanningRef.current) return;
        const scanner = await getNativeScanner();
        if (!scanner) return;

        const ok = await requestNativePermission();
        if (!ok) return;

        document.body.classList.add('barcode-scan-active');
        nativeScanningRef.current = true;

        await scanner.startScan();

        listenerRef.current = await scanner.addListener('barcodesScanned', (event: any) => {
          const value = event.barcode?.rawValue;
          if (value) onScan(value);
        });
        return;
      }

      // Web: open continuous CameraScannerModal
      continuousCallbackRef.current = onScan;
      setIsContinuous(true);
      setIsWebModalOpen(true);
    },
    []
  );

  /**
   * Stops continuous scanning and closes overlay/camera.
   */
  const stopContinuousScan = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      const scanner = await getNativeScanner();
      if (!scanner) return;

      try {
        await listenerRef.current?.remove();
        listenerRef.current = null;
        await scanner.stopScan();
      } finally {
        document.body.classList.remove('barcode-scan-active');
        nativeScanningRef.current = false;
      }
      return;
    }

    // Web: close modal and clear callbacks
    setIsWebModalOpen(false);
    continuousCallbackRef.current = null;
    if (scanResolverRef.current) {
      scanResolverRef.current(null);
      scanResolverRef.current = null;
    }
  }, []);

  // Web Modal Scan handler
  const handleWebScan = useCallback((barcode: string) => {
    if (continuousCallbackRef.current) {
      continuousCallbackRef.current(barcode);
    }
    if (scanResolverRef.current) {
      scanResolverRef.current(barcode);
      scanResolverRef.current = null;
    }
  }, []);

  // Web Modal Close handler
  const handleWebClose = useCallback(() => {
    setIsWebModalOpen(false);
    if (scanResolverRef.current) {
      scanResolverRef.current(null);
      scanResolverRef.current = null;
    }
    continuousCallbackRef.current = null;
  }, []);

  /**
   * Renders the web camera scanner modal when active.
   */
  const ScannerModal = useCallback(() => {
    if (Capacitor.isNativePlatform()) return null;

    return (
      <CameraScannerModal
        isOpen={isWebModalOpen}
        onClose={handleWebClose}
        onScan={handleWebScan}
        continuous={isContinuous}
        title={isContinuous ? 'POS Fast Barcode Scanner' : 'Scan Product Barcode'}
      />
    );
  }, [isWebModalOpen, isContinuous, handleWebClose, handleWebScan]);

  return {
    isAvailable,
    scanOnce,
    startContinuousScan,
    stopContinuousScan,
    isScanning: isWebModalOpen || nativeScanningRef.current,
    ScannerModal,
  };
}
