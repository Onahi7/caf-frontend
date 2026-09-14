import type { ReactNode } from 'react';

export type AdminBadgeTone =
  | 'neutral'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'accent';

const toneClasses: Record<AdminBadgeTone, string> = {
  neutral: 'border-white/10 bg-white/[0.06] text-slate-300',
  success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  danger: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
  warning: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  info: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
  accent: 'border-teal-500/30 bg-teal-500/15 text-teal-300',
};

const dotClasses: Record<AdminBadgeTone, string> = {
  neutral: 'bg-slate-400',
  success: 'bg-emerald-400',
  danger: 'bg-rose-400',
  warning: 'bg-amber-400',
  info: 'bg-sky-400',
  accent: 'bg-teal-400',
};

interface AdminStatusBadgeProps {
  children: ReactNode;
  tone?: AdminBadgeTone;
  className?: string;
  showDot?: boolean;
}

export function AdminStatusBadge({
  children,
  tone = 'neutral',
  className = '',
  showDot = true,
}: AdminStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClasses[tone]}`} />}
      {children}
    </span>
  );
}
