import { useState } from 'react';
import type { HeldSale } from '../../stores/held-sales-store';

interface ParkedSalesBarProps {
  heldSales: HeldSale[];
  onRecall: (id: string) => void;
  onDiscard: (id: string) => void;
  format: (n: number) => string;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export const ParkedSalesBar = ({
  heldSales,
  onRecall,
  onDiscard,
  format,
}: ParkedSalesBarProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900 border border-yellow-500/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-yellow-500/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">
              {heldSales.length} parked sale{heldSales.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-slate-400">
              Total {format(heldSales.reduce((s, h) => s + h.total, 0))}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.08] p-3 space-y-2 max-h-72 overflow-y-auto">
          {heldSales.map((sale) => (
            <div
              key={sale.id}
              className="bg-slate-950 border border-white/[0.08] rounded-lg p-3 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{sale.label}</p>
                <p className="text-xs text-slate-400">
                  {sale.items.length} item{sale.items.length !== 1 ? 's' : ''} - {format(sale.total)} - {timeAgo(sale.heldAt)}
                  {sale.customerName ? ` - ${sale.customerName}` : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => onRecall(sale.id)}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 transition-colors"
                >
                  Recall
                </button>
                <button
                  onClick={() => onDiscard(sale.id)}
                  className="px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
