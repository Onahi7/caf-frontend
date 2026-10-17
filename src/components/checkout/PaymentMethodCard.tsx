import type { ReactNode } from 'react';

export interface PaymentMethodConfig {
  id: string;
  label: string;
  shortLabel: string;
  icon: ReactNode;
  brandColor?: string;
  brandBg?: string;
}

interface PaymentMethodCardProps {
  method: PaymentMethodConfig;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const PaymentMethodCard = ({ method, isActive, onClick, disabled = false }: PaymentMethodCardProps) => {
  // Brand-specific styling
  const getBrandStyles = () => {
    switch (method.id) {
      case 'orange_money':
        return {
          active: 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/20',
          inactive: 'border-white/[0.08] bg-slate-900 hover:border-orange-500/50',
          iconActive: 'text-orange-500',
          iconInactive: 'text-slate-400',
          textActive: 'text-orange-500',
          textInactive: 'text-slate-300',
          indicator: 'bg-orange-500',
        };
      case 'africell_money':
        return {
          active: 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20',
          inactive: 'border-white/[0.08] bg-slate-900 hover:border-blue-500/50',
          iconActive: 'text-blue-500',
          iconInactive: 'text-slate-400',
          textActive: 'text-blue-500',
          textInactive: 'text-slate-300',
          indicator: 'bg-blue-500',
        };
      case 'qmoney':
        return {
          active: 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20',
          inactive: 'border-white/[0.08] bg-slate-900 hover:border-purple-500/50',
          iconActive: 'text-purple-500',
          iconInactive: 'text-slate-400',
          textActive: 'text-purple-500',
          textInactive: 'text-slate-300',
          indicator: 'bg-purple-500',
        };
      case 'card':
        return {
          active: 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20',
          inactive: 'border-white/[0.08] bg-slate-900 hover:border-indigo-500/50',
          iconActive: 'text-indigo-500',
          iconInactive: 'text-slate-400',
          textActive: 'text-indigo-500',
          textInactive: 'text-slate-300',
          indicator: 'bg-indigo-500',
        };
      case 'credit':
        return {
          active: 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20',
          inactive: 'border-white/[0.08] bg-slate-900 hover:border-amber-500/50',
          iconActive: 'text-amber-500',
          iconInactive: 'text-slate-400',
          textActive: 'text-amber-500',
          textInactive: 'text-slate-300',
          indicator: 'bg-amber-500',
        };
      default:
        return {
          active: 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20',
          inactive: 'border-white/[0.08] bg-slate-900 hover:border-white/10',
          iconActive: 'text-emerald-500',
          iconInactive: 'text-slate-400',
          textActive: 'text-emerald-500',
          textInactive: 'text-slate-300',
          indicator: 'bg-emerald-500',
        };
    }
  };

  const styles = getBrandStyles();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center gap-1.5 p-2.5 sm:p-3 rounded-xl border transition-all duration-200 min-h-[76px] active:scale-95 ${
        isActive ? styles.active : styles.inactive
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      aria-pressed={isActive}
      aria-label={method.label}
    >
      {/* Active Indicator */}
      {isActive && (
        <div className="absolute top-2 right-2 flex items-center justify-center">
          <div className={`w-2 h-2 rounded-full ${styles.indicator} animate-pulse`} />
          <div className={`absolute w-2 h-2 rounded-full ${styles.indicator} opacity-50 animate-ping`} />
        </div>
      )}
      
      {/* Icon */}
      <div className={`transition-all duration-200 [&>svg]:w-5 [&>svg]:h-5 ${isActive ? styles.iconActive : styles.iconInactive}`}>
        {method.icon}
      </div>
      
      {/* Label */}
      <span className={`text-[11px] sm:text-xs font-semibold text-center leading-tight transition-colors duration-200 ${
        isActive ? styles.textActive : styles.textInactive
      }`}>
        {method.shortLabel}
      </span>
    </button>
  );
};
