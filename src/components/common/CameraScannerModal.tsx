import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, RefreshCw, Zap, AlertCircle, CheckCircle2, Keyboard } from 'lucide-react';
import { playScanBeep } from '../../utils/scan-sound';

// Typings for native BarcodeDetector API
interface DetectedBarcode {
  rawValue: string;
  format: string;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): {
        detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]>;
      };
      getSupportedFormats: () => Promise<string[]>;
    };
  }
}

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  continuous?: boolean;
  title?: string;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  continuous = false,
  title = 'Scan Barcode',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState<number>(0);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [hasBarcodeDetector, setHasBarcodeDetector] = useState<boolean>(true);

  // Stop camera tracks and scanning loop
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      window.cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
  }, []);

  // Initialize and start camera
  const startCamera = useCallback(async (deviceId?: string) => {
    stopCamera();
    setErrorMessage(null);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setHasCamera(false);
      setErrorMessage('Camera access is not supported by your browser.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
      setTorchSupported(!!capabilities?.torch);

      // Enumerate cameras for switching
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);
      } catch {
        // Enumerate fallback
      }
    } catch (err: unknown) {
      console.warn('Camera access failed:', err);
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera permissions in your browser settings.'
          : 'Could not access the camera. Ensure no other application is using it.';
      setErrorMessage(msg);
    }
  }, [stopCamera]);

  // Toggle flashlight
  const toggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Could not toggle torch', e);
    }
  };

  // Switch between front/back/external cameras
  const switchCamera = () => {
    if (availableCameras.length <= 1) return;
    const nextIndex = (activeCameraIndex + 1) % availableCameras.length;
    setActiveCameraIndex(nextIndex);
    startCamera(availableCameras[nextIndex].deviceId);
  };

  // Run barcode detection loop using native BarcodeDetector API
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    const supportsDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    setHasBarcodeDetector(supportsDetector);

    startCamera();

    let isScanning = true;
    let detector: any = null;

    if (supportsDetector && window.BarcodeDetector) {
      try {
        detector = new window.BarcodeDetector({
          formats: [
            'ean_13',
            'ean_8',
            'code_128',
            'code_39',
            'code_93',
            'upc_a',
            'upc_e',
            'qr_code',
            'data_matrix',
            'itf',
          ],
        });
      } catch (e) {
        console.warn('BarcodeDetector format init warning:', e);
      }
    }

    const scanFrame = async () => {
      if (!isScanning) return;

      const video = videoRef.current;
      if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && detector) {
        try {
          const barcodes: DetectedBarcode[] = await detector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0].rawValue.trim();
            const now = performance.now();

            // Avoid scanning the exact same barcode multiple times within 2 seconds
            const isDuplicate =
              raw === lastScannedCodeRef.current && now - lastScanTimeRef.current < 2000;

            if (raw && !isDuplicate) {
              lastScannedCodeRef.current = raw;
              lastScanTimeRef.current = now;

              playScanBeep(true);
              setLastScannedFeedback(raw);

              onScan(raw);

              if (!continuous) {
                // Single scan mode: close immediately on success
                stopCamera();
                onClose();
                return;
              }
            }
          }
        } catch {
          // Frame decode exception (ignore individual frames)
        }
      }

      // Schedule next frame with 120ms throttle to preserve battery and CPU
      scanLoopRef.current = window.setTimeout(() => {
        scanLoopRef.current = window.requestAnimationFrame(scanFrame);
      }, 120) as unknown as number;
    };

    scanLoopRef.current = window.requestAnimationFrame(scanFrame);

    return () => {
      isScanning = false;
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera, onScan, onClose, continuous]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    playScanBeep(true);
    onScan(code);
    setManualCode('');
    if (!continuous) {
      stopCamera();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm tracking-tight">{title}</h3>
              <p className="text-[11px] text-slate-400">
                {continuous ? 'Continuous scanning active' : 'Point camera at barcode'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative flex-1 bg-black min-h-[300px] max-h-[460px] flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Targeting Laser Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
            <div className="relative w-full max-w-[280px] h-[190px] border-2 border-emerald-400/40 rounded-2xl overflow-hidden shadow-2xl">
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

              {/* Animated Laser Scanning Beam */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-bounce" />
            </div>
          </div>

          {/* Camera Controls Overlay (Top Right of Video) */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl backdrop-blur-md border text-xs font-medium transition-all ${
                  torchOn
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/30'
                    : 'bg-black/40 text-white border-white/20 hover:bg-black/60'
                }`}
                title={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
              >
                <Zap className="w-4 h-4" />
              </button>
            )}

            {availableCameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                className="p-2 rounded-xl bg-black/40 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all"
                title="Switch camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Feedback Toast on Successful Scan */}
          {lastScannedFeedback && (
            <div className="absolute top-3 left-3 right-3 sm:left-auto sm:right-3 bg-emerald-500/90 text-slate-950 font-bold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 text-xs backdrop-blur-md animate-in slide-in-from-top-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Scanned: {lastScannedFeedback}</span>
            </div>
          )}

          {/* Error Message Display */}
          {errorMessage && (
            <div className="absolute inset-x-4 top-4 bg-rose-500/90 text-white p-3.5 rounded-2xl shadow-xl flex items-start gap-2.5 text-xs backdrop-blur-md">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Camera Access Warning</p>
                <p className="opacity-90 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Fallback Notice for Non-Chromium Browsers */}
          {!hasBarcodeDetector && (
            <div className="absolute bottom-3 inset-x-4 bg-slate-900/90 border border-white/10 p-2.5 rounded-xl text-center backdrop-blur-md">
              <p className="text-[11px] text-slate-300">
                Tip: Direct web camera scanning works natively in Chrome & Edge. You can also use a USB scanner or type below.
              </p>
            </div>
          )}
        </div>

        {/* Footer / Manual Input Option */}
        <div className="p-4 bg-slate-900/70 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Can't scan the package?</span>
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <Keyboard className="w-3.5 h-3.5" />
              {showManualInput ? 'Hide manual entry' : 'Type barcode manually'}
            </button>
          </div>

          {showManualInput && (
            <form onSubmit={handleManualSubmit} className="flex gap-2 animate-in fade-in duration-150">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter barcode numbers..."
                className="flex-1 px-3 py-2 bg-slate-950 border border-white/15 rounded-xl text-white text-xs font-mono focus:border-emerald-500/50 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-xs transition-colors"
              >
                Submit
              </button>
            </form>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
            <span>USB/Bluetooth Barcode Guns supported</span>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
