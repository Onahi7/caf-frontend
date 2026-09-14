import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { LoaderCircle } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
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
      'font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary-darker disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] select-none inline-flex items-center justify-center cursor-pointer';

    const variantStyles = {
      primary:
        'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold shadow-md shadow-emerald-950/40 hover:shadow-lg hover:shadow-emerald-900/30 focus:ring-emerald-500 border border-emerald-400/20',
      secondary:
        'bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 hover:border-white/20 focus:ring-slate-400 shadow-xs',
      danger:
        'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40 focus:ring-rose-500 shadow-xs',
      ghost:
        'bg-transparent text-slate-400 hover:text-white hover:bg-white/[0.06] focus:ring-slate-500 border border-transparent',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs min-h-9 gap-1.5',
      md: 'px-4 py-2.5 text-sm min-h-11 gap-2',
      lg: 'px-6 py-3 text-base min-h-12 gap-2.5 font-semibold',
    };

    const spinnerSizes = {
      sm: 'h-3.5 w-3.5',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <LoaderCircle className={`animate-spin ${spinnerSizes[size]}`} aria-hidden="true" />
            <span>{loadingLabel ?? children}</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
