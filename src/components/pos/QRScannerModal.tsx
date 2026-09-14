import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, ScanLine, ArrowRight } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

export const QRScannerModal = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Barcode / QR Code',
}: QRScannerModalProps) => {
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { showError } = useToast();

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      showError('Camera access denied. Please enter code manually.');
      setScanning(false);
    }
  }, [showError]);

  useEffect(() => {
    if (isOpen && scanning) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, scanning, startCamera, stopCamera]);

  const handleManualSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!manualCode.trim()) return;
    onScan(manualCode.trim());
    handleClose();
  };

  const handleClose = () => {
    stopCamera();
    setScanning(false);
    setManualCode('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="sm">
      <div className="space-y-4">
        {/* Camera View */}
        {scanning ? (
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black border border-white/[0.1] shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Target Reticle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-52 h-52 border-2 border-emerald-400 rounded-2xl relative shadow-lg shadow-emerald-500/20">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-400/80 animate-pulse" />
              </div>
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setScanning(false)}
              >
                Stop Camera
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setScanning(true)}
            className="group relative flex w-full aspect-video flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/[0.12] bg-slate-950/40 p-6 text-center hover:border-emerald-500/40 hover:bg-slate-900/60 transition-all duration-200"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 group-hover:scale-110 transition-transform">
              <Camera className="h-6 w-6" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-white">Enable Camera Scanner</p>
              <p className="text-xs text-slate-400">Point at physical barcode or QR label</p>
            </div>
          </button>
        )}

        {/* Manual Entry Fallback */}
        <form onSubmit={handleManualSubmit} className="space-y-2 pt-1">
          <label
            htmlFor="barcode-manual-input"
            className="block text-xs font-semibold text-slate-300"
          >
            Or Enter Code Manually
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 select-none" />
              <input
                id="barcode-manual-input"
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Scan or type barcode number..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-slate-950/60 text-white placeholder-slate-500 text-sm focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                autoFocus={!scanning}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={!manualCode.trim()}
              className="shrink-0"
            >
              <span>Submit</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-80" />
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
