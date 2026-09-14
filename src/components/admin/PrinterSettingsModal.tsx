import React, { useState } from 'react';
import { Printer, Wifi, Bluetooth, Usb, Info } from 'lucide-react';
import {
  getPrinterConfig,
  type PrinterConfig,
} from '../../lib/receipt-printer';
import apiClient from '../../lib/api-client';
import { useToast } from '../../hooks/useToast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

type SavedPrinterConfig = PrinterConfig & { _id?: string };

interface PrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  terminalId: string;
}

export const PrinterSettingsModal: React.FC<PrinterSettingsModalProps> = ({
  isOpen,
  onClose,
  branchId,
  terminalId,
}) => {
  const [, setConfig] = useState<SavedPrinterConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    model: 'generic_esc_pos' as PrinterConfig['model'],
    connectionType: 'network' as PrinterConfig['connectionType'],
    paperWidth: 80 as 58 | 80,
    ipAddress: '',
    port: 9100,
    bluetoothName: '',
    autoPrintEnabled: false,
    defaultCopies: 1,
  });

  React.useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await getPrinterConfig(branchId, terminalId);
      if (data) {
        setConfig(data as SavedPrinterConfig);
        setFormData({
          name: data.name,
          model: data.model,
          connectionType: data.connectionType,
          paperWidth: data.paperWidth,
          ipAddress: data.ipAddress || '',
          port: data.port || 9100,
          bluetoothName: data.bluetoothName || '',
          autoPrintEnabled: data.autoPrintEnabled,
          defaultCopies: data.defaultCopies,
        });
      }
    } catch (error) {
      console.error('Failed to load printer config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/printers/config', {
        branchId,
        terminalId,
        ...formData,
      });
      showSuccess('Printer settings saved successfully');
      onClose();
    } catch (error) {
      showError('Failed to save printer settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thermal Receipt Printer" size="lg">
      <form onSubmit={handleSave} className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-slate-950/40 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
            <Printer className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Hardware Configuration</h4>
            <p className="text-xs text-slate-400">
              Configure ESC/POS receipt printing for terminal #{terminalId}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Printer Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Main Register Thermal Printer"
            required
          />

          <Select
            label="Connection Protocol"
            value={formData.connectionType}
            onChange={(e) =>
              setFormData({
                ...formData,
                connectionType: e.target.value as PrinterConfig['connectionType'],
              })
            }
            options={[
              { value: 'network', label: 'Network (WiFi / Ethernet IP)' },
              { value: 'bluetooth', label: 'Bluetooth (Tablet / Mobile)' },
              { value: 'usb', label: 'USB (Desktop Web Serial)' },
              { value: 'serial', label: 'Serial COM Port' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Paper Roll Width"
            value={String(formData.paperWidth)}
            onChange={(e) =>
              setFormData({
                ...formData,
                paperWidth: Number(e.target.value) as 58 | 80,
              })
            }
            options={[
              { value: '80', label: '80mm (Standard POS Wide)' },
              { value: '58', label: '58mm (Compact Mobile Receipt)' },
            ]}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Default Print Copies
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={formData.defaultCopies}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  defaultCopies: Math.max(1, Number(e.target.value)),
                })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-slate-950/60 text-white text-sm focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Network IP / Port */}
        {formData.connectionType === 'network' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 p-4 rounded-2xl border border-white/[0.06] bg-slate-950/30">
            <Input
              label="Printer IP Address"
              value={formData.ipAddress}
              onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
              placeholder="192.168.1.100"
              required
            />
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Port (RAW)</label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                placeholder="9100"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-slate-950/60 text-white text-sm focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        )}

        {/* Bluetooth Name */}
        {formData.connectionType === 'bluetooth' && (
          <div className="p-4 rounded-2xl border border-white/[0.06] bg-slate-950/30">
            <Input
              label="Bluetooth Device Name"
              value={formData.bluetoothName}
              onChange={(e) => setFormData({ ...formData, bluetoothName: e.target.value })}
              placeholder="e.g. MPT-II or POS-58"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Bluetooth pairing prompt will appear when sending print jobs.
            </p>
          </div>
        )}

        {/* Auto Print Toggle */}
        <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/[0.08] bg-slate-950/30 cursor-pointer hover:bg-slate-950/50 transition-colors">
          <input
            type="checkbox"
            checked={formData.autoPrintEnabled}
            onChange={(e) => setFormData({ ...formData, autoPrintEnabled: e.target.checked })}
            className="h-4 w-4 rounded border-white/20 bg-slate-900 text-emerald-500 focus:ring-emerald-500/30"
          />
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-white">Auto-print receipt upon sale completion</span>
            <span className="block text-xs text-slate-400">
              Immediately triggers hardware print when payment is confirmed in POS
            </span>
          </div>
        </label>

        {/* Deployment Info Callout */}
        <div className="flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs text-sky-200">
          <Info className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
          <p className="leading-relaxed">
            Network printers connect directly to local LAN. Bluetooth requires Web Bluetooth in compatible mobile browsers. USB uses Web Serial on Chrome/Edge desktops.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            isLoading={loading}
            className="flex-1"
          >
            Save Printer Settings
          </Button>
        </div>
      </form>
    </Modal>
  );
};
