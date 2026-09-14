import { forwardRef, useId, type SelectHTMLAttributes } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  children?: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, children, className = '', id: externalId, ...props }, ref) => {
    const autoId = useId();
    const selectId = externalId || autoId;
    const errorId = error ? `${selectId}-error` : undefined;
    const helperId = helperText && !error ? `${selectId}-helper` : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-slate-200 mb-1.5">
            {label}
            {props.required && <span className="text-rose-400 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          aria-describedby={errorId || helperId || undefined}
          className={`
            w-full px-3.5 py-2.5 rounded-xl
            bg-slate-900/70 text-slate-100 text-sm
            border ${error ? 'border-rose-500/60 focus:border-rose-500' : 'border-white/10 hover:border-white/20 focus:border-emerald-500/80'}
            focus:outline-none focus:ring-2 ${error ? 'focus:ring-rose-500/20' : 'focus:ring-emerald-500/20'}
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 shadow-xs cursor-pointer
            [&>option]:bg-slate-900 [&>option]:text-slate-100
            ${className}
          `}
          {...props}
        >
          {options ? (
            options.map((option) => (
              <option key={option.value} value={option.value} className="bg-slate-900 text-slate-100">
                {option.label}
              </option>
            ))
          ) : (
            children
          )}
        </select>
        {error && (
          <p id={errorId} className="mt-1 text-sm text-red-500">{error}</p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1 text-sm text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
