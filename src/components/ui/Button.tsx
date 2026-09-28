import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingLabel,
      disabled,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'relative font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed select-none inline-flex items-center justify-center cursor-pointer overflow-hidden active:scale-[0.98] disabled:active:scale-100';

    const variantStyles = {
      primary:
        'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold shadow-lg shadow-emerald-950/40 hover:shadow-emerald-900/50 focus:ring-emerald-500 border border-emerald-400/25 hover:border-emerald-300/40',
      secondary:
        'bg-slate-800/80 hover:bg-slate-700/80 text-slate-100 border border-slate-700/70 hover:border-slate-600 focus:ring-slate-400 shadow-sm shadow-black/20 hover:text-white',
      danger:
        'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 hover:border-rose-500/50 focus:ring-rose-500 shadow-sm shadow-rose-950/20 hover:text-rose-200',
      ghost:
        'bg-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 focus:ring-slate-500 border border-transparent',
      outline:
        'bg-transparent text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-500/70 focus:ring-emerald-500 shadow-xs',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs min-h-[34px] gap-1.5',
      md: 'px-4 py-2.5 text-sm min-h-[42px] gap-2',
      lg: 'px-6 py-3 text-base min-h-[48px] gap-2.5 font-semibold',
    };

    const spinnerSizes = {
      sm: 'h-3.5 w-3.5',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
    };

    const isExplicitLabelLoading = Boolean(isLoading && loadingLabel);

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isExplicitLabelLoading ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 className={`animate-spin ${spinnerSizes[size]} text-current`} aria-hidden="true" />
            <span className="truncate">{loadingLabel}</span>
          </span>
        ) : (
          <>
            {isLoading && (
              <span className="absolute inset-0 flex items-center justify-center bg-inherit/80 backdrop-blur-[1px] rounded-xl z-10">
                <Loader2 className={`animate-spin ${spinnerSizes[size]} text-current`} aria-hidden="true" />
              </span>
            )}
            <span className={`inline-flex items-center justify-center gap-2 transition-opacity duration-150 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
              {children}
            </span>
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
