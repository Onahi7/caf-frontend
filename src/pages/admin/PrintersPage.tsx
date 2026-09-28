import React, { useEffect, useState } from 'react';
import { CheckCircle, Edit2, Plus, Printer, TestTube, Trash2, XCircle } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { unwrapArray } from '../../lib/unwrap-response';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { BranchSelector } from '../../components/BranchSelector';
import { PrinterSettingsModal } from '../../components/admin/PrinterSettingsModal';
import { useToast } from '../../hooks/useToast';
import { getBranchId, useBranchStore } from '../../stores/branch-store';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { useConfirm } from '../../hooks/useConfirm';

interface PrinterConfig {
  _id: string;
  branchId: {
    _id: string;
    name: string;
  } | string;
  terminalId: string;
  name: string;
  model: string;
  connectionType: string;
  paperWidth: number;
  ipAddress?: string;
  port?: number;
  bluetoothName?: string;
  autoPrintEnabled: boolean;
  defaultCopies: number;
  isActive: boolean;
  lastTestAt?: string;
  lastTestStatus?: 'success' | 'failed';
  lastTestError?: string;
}

export const PrintersPage: React.FC = () => {
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterConfig | null>(null);
  const { showSuccess, showError } = useToast();
  const requestConfirmation = useConfirm();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const branches = useBranchStore((state) => state.branches);
  const branchId = getBranchId(selectedBranch);
  const effectiveBranchId = branchId || branches[0]?._id || (branches[0] as any)?.id || '';
  const terminalId = 'TERMINAL-01';

  useEffect(() => {
    void loadPrinters();
  }, [branchId]);

  const loadPrinters = async () => {
    setLoading(true);
    try {
      const endpoint = branchId ? `/printers/branch/${branchId}` : '/printers';
      const response = await apiClient.get(endpoint);
      setPrinters(unwrapArray(response.data));
    } catch (error) {
      console.error('Failed to load printers:', error);
      showError('Failed to load printers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingPrinter(null);
    setIsSettingsOpen(true);
  };

  const handleOpenEdit = (printer: PrinterConfig) => {
    setEditingPrinter(printer);
    setIsSettingsOpen(true);
  };

  const testConnection = async (id: string) => {
    setTesting(id);
    try {
      const response = await apiClient.post(`/printers/${id}/test`);
      showSuccess(response.data.message ?? 'Printer test successful');
      await loadPrinters();
    } catch {
      showError('Failed to test printer connection');
    } finally {
      setTesting(null);
    }
  };

  const deletePrinter = async (printer: PrinterConfig) => {
    const confirmed = await requestConfirmation({
      title: 'Delete printer?',
      message: `"${printer.name}" will be removed from this terminal. Receipts will no longer print to it.`,
      confirmLabel: 'Delete printer',
      variant: 'danger',
    });
    if (!confirmed) return;

    setDeleting(printer._id);
    try {
      await apiClient.delete(`/printers/${printer._id}`);
      showSuccess('Printer deleted');
      await loadPrinters();
    } catch {
      showError('Failed to delete printer');
    } finally {
      setDeleting(null);
    }
  };

  const getConnectionIcon = (type: string) => {
    switch (type) {
      case 'network':
        return 'Network';
      case 'bluetooth':
        return 'Bluetooth';
      case 'usb':
        return 'USB';
      case 'serial':
        return 'Serial';
      default:
        return 'Printer';
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Thermal Printers">
        <Loading variant="centered" text="Loading printers…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Thermal Printers">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Printer className="mt-1 h-8 w-8 text-accent-green" />
            <div>
              <h1 className="text-2xl font-bold text-white">Thermal Printers</h1>
              <p className="mt-1 text-sm text-gray-400">
                Manage receipt printing for the selected branch and terminal.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BranchSelector />
            <Button onClick={handleOpenAdd} className="inline-flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Add Printer</span>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-accent-green/20 bg-white/5 p-4 text-sm text-gray-300">
          <h3 className="mb-2 font-semibold text-white">Mobile and web compatibility</h3>
          <div className="space-y-1">
            <p><strong className="text-white">Network printers:</strong> work on Windows, Mac, Android, and iOS.</p>
            <p><strong className="text-white">Bluetooth printers:</strong> best for Android handheld devices.</p>
            <p><strong className="text-white">USB and serial printers:</strong> best for fixed desktop counters.</p>
          </div>
        </div>

        {printers.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-primary-dark">
            <EmptyState
              icon={<Printer className="h-12 w-12" />}
              title="No printers configured"
              message="Add a printer to start printing receipts from this terminal."
              action={{ label: 'Add your first printer', onClick: handleOpenAdd }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {printers.map((printer) => (
              <div
                key={printer._id}
                className="rounded-xl border border-white/10 bg-primary-dark p-4 shadow-sm"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-gray-500">{getConnectionIcon(printer.connectionType)}</p>
                    <h3 className="truncate text-lg font-semibold text-white">{printer.name}</h3>
                    <p className="truncate text-xs text-gray-400">
                      {typeof printer.branchId === 'object' ? printer.branchId.name : 'Unknown Branch'} - {printer.terminalId}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      printer.isActive ? 'border border-accent-green/20 bg-accent-green/15 text-accent-green' : 'bg-white/10 text-gray-300'
                    }`}
                  >
                    {printer.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-gray-400">Type</span>
                    <span className="text-right font-medium capitalize text-white">{printer.connectionType}</span>
                  </div>
                  {printer.connectionType === 'network' ? (
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-gray-400">Address</span>
                      <span className="text-right font-medium text-white">{printer.ipAddress}:{printer.port}</span>
                    </div>
                  ) : null}
                  {printer.connectionType === 'bluetooth' ? (
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-gray-400">Device</span>
                      <span className="text-right font-medium text-white">{printer.bluetoothName || '-'}</span>
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-gray-400">Paper</span>
                    <span className="font-medium text-white">{printer.paperWidth}mm</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-gray-400">Auto-print</span>
                    <span className="text-right font-medium text-white">
                      {printer.autoPrintEnabled ? `Yes (${printer.defaultCopies}x)` : 'No'}
                    </span>
                  </div>
                  {printer.lastTestAt ? (
                    <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                      <span className="text-gray-400">Last Test</span>
                      <div className="flex items-center gap-1">
                        {printer.lastTestStatus === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-accent-green" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                        <span className={`text-xs ${printer.lastTestStatus === 'success' ? 'text-accent-green' : 'text-red-300'}`}>
                          {new Date(printer.lastTestAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => testConnection(printer._id)}
                    isLoading={testing === printer._id}
                    className="flex-1 text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      <TestTube className="h-4 w-4" />
                      <span>{testing === printer._id ? 'Testing...' : 'Test'}</span>
                    </span>
                  </Button>
                  <Button
                    onClick={() => handleOpenEdit(printer)}
                    variant="secondary"
                    className="px-3"
                    aria-label={`Edit ${printer.name}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => deletePrinter(printer)}
                    variant="danger"
                    isLoading={deleting === printer._id}
                    loadingLabel="Deleting"
                    className="px-3"
                    aria-label={`Delete ${printer.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {printer.lastTestError ? (
                  <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-300">
                    {printer.lastTestError}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {effectiveBranchId ? (
          <PrinterSettingsModal
            isOpen={isSettingsOpen}
            onClose={() => {
              setIsSettingsOpen(false);
              setEditingPrinter(null);
              void loadPrinters();
            }}
            branchId={effectiveBranchId}
            terminalId={terminalId}
            printer={editingPrinter}
          />
        ) : null}
      </div>
    </AdminLayout>
  );
};
