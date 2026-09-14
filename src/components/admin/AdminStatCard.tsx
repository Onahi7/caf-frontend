import type { ReactNode } from 'react';

interface AdminStatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'accent';
  helper?: ReactNode;
}

const toneClasses = {
  neutral: 'border-white/[0.08] bg-slate-900/70 hover:border-white/15 shadow-black/20',
  success: 'border-emerald-500/20 bg-emerald-950/25 hover:border-emerald-500/30 shadow-emerald-950/20',
  danger: 'border-rose-500/20 bg-rose-950/25 hover:border-rose-500/30 shadow-rose-950/20',
  warning: 'border-amber-500/20 bg-amber-950/25 hover:border-amber-500/30 shadow-amber-950/20',
  info: 'border-sky-500/20 bg-sky-950/25 hover:border-sky-500/30 shadow-sky-950/20',
  accent: 'border-teal-500/20 bg-teal-950/25 hover:border-teal-500/30 shadow-teal-950/20',
};

const iconClasses = {
  neutral: 'bg-white/[0.06] text-slate-300 border border-white/10',
  success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  danger: 'bg-rose-500/15 text-rose-400 border border-rose-500/25',
  warning: 'bg-amber-500/15 text-amber-300 border border-amber-500/25',
  info: 'bg-sky-500/15 text-sky-400 border border-sky-500/25',
  accent: 'bg-teal-500/15 text-teal-300 border border-teal-500/25',
};

export function AdminStatCard({
  label,
  value,
  icon,
  tone = 'neutral',
  helper,
}: AdminStatCardProps) {
  return (
    <div className={`rounded-2xl border p-5 shadow-lg backdrop-blur-md transition-all duration-200 ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {icon ? (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClasses[tone]}`}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-50 tracking-tight tabular-nums">{value}</div>
      {helper ? <div className="mt-1.5 text-xs text-slate-400">{helper}</div> : null}
    </div>
  );
}
