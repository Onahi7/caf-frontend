import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { PACK_TYPE_OPTIONS } from '../../lib/product-options';

export interface PackSize {
  code?: string;
  name: string;
  unit: string;
  quantityPerPack: number;
  sellingPrice: number;
  barcode?: string;
  _clientId?: string;
}

interface PackSizeRowProps {
  pack: PackSize;
  baseUnit: string;
  formatCurrency: (amount: number) => string;
  onChange: (updated: PackSize) => void;
  onDelete: () => void;
}

export const PackSizeRow = ({
  pack,
  baseUnit,
  formatCurrency,
  onChange,
  onDelete,
}: PackSizeRowProps) => {
  const [name, setName] = useState(pack.name || '');
  const [qty, setQty] = useState(pack.quantityPerPack !== undefined ? String(pack.quantityPerPack) : '1');
  const [barcode, setBarcode] = useState(pack.barcode || '');
  const [price, setPrice] = useState(pack.sellingPrice !== undefined ? String(pack.sellingPrice) : '0');

  useEffect(() => {
    setName(pack.name || '');
  }, [pack.name]);

  useEffect(() => {
    setBarcode(pack.barcode || '');
  }, [pack.barcode]);

  useEffect(() => {
    const currentNum = parseInt(qty, 10);
    if (!isNaN(currentNum) && currentNum !== pack.quantityPerPack) {
      setQty(String(pack.quantityPerPack ?? 1));
    }
  }, [pack.quantityPerPack]);

  useEffect(() => {
    const currentPrice = parseFloat(price);
    if (!isNaN(currentPrice) && currentPrice !== pack.sellingPrice) {
      setPrice(String(pack.sellingPrice ?? 0));
    }
  }, [pack.sellingPrice]);

  const handleTypeSelect = (selectedType: string) => {
    setName(selectedType);
    const unit = selectedType ? selectedType.trim().toLowerCase().replace(/\s+/g, '-') : pack.unit;
    onChange({
      ...pack,
      name: selectedType,
      unit,
    });
  };

  const handleNameChange = (val: string) => {
    setName(val);
    const unit = val.trim().toLowerCase().replace(/\s+/g, '-');
    onChange({
      ...pack,
      name: val,
      unit,
    });
  };

  const handleQtyChange = (val: string) => {
    if (/^\d*$/.test(val)) {
      setQty(val);
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) {
        onChange({
          ...pack,
          quantityPerPack: parsed,
        });
      }
    }
  };

  const handleQtyBlur = () => {
    const parsed = parseInt(qty, 10);
    const safeQty = !isNaN(parsed) && parsed > 0 ? parsed : 1;
    setQty(String(safeQty));
    onChange({
      ...pack,
      quantityPerPack: safeQty,
    });
  };

  const handleBarcodeChange = (val: string) => {
    setBarcode(val);
    onChange({
      ...pack,
      barcode: val,
    });
  };

  const handlePriceChange = (val: string) => {
    if (/^\d*\.?\d*$/.test(val)) {
      setPrice(val);
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed >= 0) {
        onChange({
          ...pack,
          sellingPrice: parsed,
        });
      }
    }
  };

  const handlePriceBlur = () => {
    const parsed = parseFloat(price);
    const safePrice = !isNaN(parsed) && parsed >= 0 ? parsed : 0;
    setPrice(String(safePrice));
    onChange({
      ...pack,
      sellingPrice: safePrice,
    });
  };

  const numQty = parseInt(qty, 10) || 1;
  const numPrice = parseFloat(price) || 0;
  const unitRate = numPrice / Math.max(1, numQty);

  return (
    <div className="flex items-start gap-3 p-3.5 bg-slate-950/70 rounded-2xl border border-white/[0.08] shadow-md shadow-black/20">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Package Type</label>
          <select
            value={name}
            onChange={(e) => handleTypeSelect(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:border-emerald-500/50 focus:outline-none"
          >
            <option value="">Select type (Card, Box...)</option>
            {PACK_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Name on Receipt / POS</label>
          <input
            placeholder="e.g. Card of 10, Box of 100"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:border-emerald-500/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">How many {baseUnit || 'units'} per pack?</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="e.g. 10 or 100"
            value={qty}
            onChange={(e) => handleQtyChange(e.target.value)}
            onBlur={handleQtyBlur}
            onWheel={(e) => e.currentTarget.blur()}
            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:border-emerald-500/50 focus:outline-none font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Pack Selling Price</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Price for 1 pack"
            value={price}
            onChange={(e) => handlePriceChange(e.target.value)}
            onBlur={handlePriceBlur}
            onWheel={(e) => e.currentTarget.blur()}
            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:border-emerald-500/50 focus:outline-none font-mono text-emerald-300 font-semibold"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Pack Barcode (Optional)</label>
          <input
            placeholder="Scan or enter barcode printed on the box/pack"
            value={barcode}
            onChange={(e) => handleBarcodeChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:border-emerald-500/50 focus:outline-none font-mono"
          />
        </div>
        <div className="sm:col-span-2 md:col-span-3 rounded-xl bg-slate-900/90 border border-white/[0.06] px-3.5 py-2.5 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <span>1 <strong>{name || 'Pack'}</strong> contains <strong>{numQty} {baseUnit || 'units'}</strong></span>
          <span className="font-semibold text-emerald-400 font-mono">Effective price: {formatCurrency(unitRate)} each</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0 mt-6"
        aria-label="Delete pack size"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};
