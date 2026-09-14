import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id: externalId, ...props }, ref) => {
    const autoId = useId();
    const inputId = externalId || autoId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-200 mb-1.5">
            {label}
            {props.required && <span className="text-rose-400 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={errorId || helperId || undefined}
          className={`
            w-full px-3.5 py-2.5 rounded-xl
            bg-slate-900/70 text-slate-100 text-sm
            border ${error ? 'border-rose-500/60 focus:border-rose-500' : 'border-white/10 hover:border-white/20 focus:border-emerald-500/80'}
            focus:outline-none focus:ring-2 ${error ? 'focus:ring-rose-500/20' : 'focus:ring-emerald-500/20'}
            disabled:opacity-50 disabled:cursor-not-allowed
            placeholder:text-slate-500
            transition-all duration-200 shadow-xs
            ${className}
          `}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1.5 text-xs text-rose-400 font-medium">{error}</p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-xs text-slate-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
