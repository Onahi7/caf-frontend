import { useState } from 'react';
import { downloadPDFReceipt, printPDFReceipt, sendToThermalPrinter } from '../../lib/receipt-printer';
import { useToast } from '../../hooks/useToast';

interface ReceiptActionsProps {
  saleId: string;
  receiptNumber: string;
  compact?: boolean;
}

export const ReceiptActions = ({ saleId, receiptNumber, compact = false }: ReceiptActionsProps) => {
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { showError, showSuccess } = useToast();

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printPDFReceipt(saleId);
      showSuccess('Receipt print opened');
    } catch (error) {
      showError('Failed to print receipt. Please try again.');
    } finally {
      setPrinting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadPDFReceipt(saleId);
      showSuccess('Receipt downloaded');
    } catch (error) {
      showError('Failed to download receipt. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleThermalPrint = async () => {
    setPrinting(true);
    try {
      await sendToThermalPrinter(saleId, 80);
      showSuccess('Thermal receipt prepared');
    } catch (error) {
      showError('Failed to send to thermal printer. Please ensure printer is connected.');
    } finally {
      setPrinting(false);
    }
  };

  if (compact) {
    return (
      <div className="flex gap-2">
        <button
          onClick={handlePrint}
          disabled={printing}
          className="px-3 py-1.5 bg-emerald-500 text-slate-950 font-medium rounded hover:bg-emerald-400 disabled:opacity-50 text-sm flex items-center gap-1"
          title="Print Receipt (PDF)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          {printing ? 'Printing...' : 'Print'}
        </button>
        
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="px-3 py-1.5 bg-slate-800 text-slate-100 rounded hover:bg-slate-700 disabled:opacity-50 text-sm flex items-center gap-1"
          title="Download Receipt (PDF)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloading ? 'Downloading...' : 'Download'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Receipt Actions</h3>
        <span className="text-sm text-slate-400">#{receiptNumber}</span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {/* Print PDF */}
        <button
          onClick={handlePrint}
          disabled={printing}
          className="flex items-center justify-center gap-3 px-4 py-3 bg-emerald-500 text-slate-950 font-medium rounded-lg hover:bg-emerald-400 disabled:opacity-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          <span>{printing ? 'Printing...' : 'Print Receipt (PDF)'}</span>
        </button>

        {/* Download PDF */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center justify-center gap-3 px-4 py-3 bg-slate-800 text-slate-100 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>{downloading ? 'Downloading...' : 'Download PDF'}</span>
        </button>

        {/* Thermal Printer */}
        <button
          onClick={handleThermalPrint}
          disabled={printing}
          className="flex items-center justify-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>{printing ? 'Sending...' : 'Send to Thermal Printer'}</span>
        </button>
      </div>

      <div className="mt-2 text-xs text-slate-400">
        <p>- PDF receipts can be printed on any standard printer</p>
        <p>- Thermal printer requires driver installation or USB connection</p>
      </div>
    </div>
  );
};
