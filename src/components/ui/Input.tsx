import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string | ReactNode;
  labelRight?: ReactNode;
  error?: string;
  helperText?: string;
  showPasswordToggle?: boolean;
  endAction?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      labelRight,
      error,
      helperText,
      showPasswordToggle = true,
      endAction,
      className = '',
      id: externalId,
      type,
      ...props
    },
    ref,
  ) => {
    const autoId = useId();
    const inputId = externalId || autoId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const [showPassword, setShowPassword] = useState(false);

    const isPassword = type === 'password';
    const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;
    const hasToggle = isPassword && showPasswordToggle;

    return (
      <div className="w-full">
        {(label || labelRight) && (
          <div className="flex items-center justify-between mb-1.5 gap-2">
            {label && (
              <label htmlFor={inputId} className="block text-sm font-medium text-slate-200">
                {label}
                {props.required && <span className="text-rose-400 ml-1">*</span>}
              </label>
            )}
            {labelRight && <div className="text-xs">{labelRight}</div>}
          </div>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            aria-invalid={!!error}
            aria-describedby={errorId || helperId || undefined}
            onWheel={(e) => {
              if (type === 'number') {
                e.currentTarget.blur();
              }
              props.onWheel?.(e);
            }}
            className={`
              w-full min-h-11 px-3.5 py-2.5 rounded-xl
              bg-slate-900/70 text-slate-100 text-base sm:text-sm
              border ${error ? 'border-rose-500/60 focus:border-rose-500' : 'border-white/10 hover:border-white/20 focus:border-emerald-500/80'}
              focus:outline-none focus:ring-2 ${error ? 'focus:ring-rose-500/20' : 'focus:ring-emerald-500/20'}
              disabled:opacity-50 disabled:cursor-not-allowed
              placeholder:text-slate-500
              transition-all duration-200 shadow-xs
              ${hasToggle || endAction ? 'pr-11' : ''}
              ${className}
            `}
            {...props}
          />
          {hasToggle && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 focus:outline-none focus:text-emerald-400 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          {endAction && !hasToggle && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {endAction}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-xs text-rose-400 font-medium">{error}</p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-xs text-slate-400">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
