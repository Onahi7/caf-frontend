import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id: externalId, ...props }, ref) => {
    const autoId = useId();
    const textareaId = externalId || autoId;
    const errorId = error ? `${textareaId}-error` : undefined;
    const helperId = helperText && !error ? `${textareaId}-helper` : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-white mb-1">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={!!error}
          aria-describedby={errorId || helperId || undefined}
          className={`
            w-full px-4 py-2.5 rounded-xl
            bg-white/5 text-white
            border ${error ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-accent-green/50'}
            focus:outline-none focus:ring-2 ${error ? 'focus:ring-red-500/20' : 'focus:ring-accent-green/20'}
            disabled:opacity-50 disabled:cursor-not-allowed
            placeholder-slate-500
            transition-all duration-200
            resize-y
            ${className}
          `}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1 text-sm text-red-500">{error}</p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1 text-sm text-slate-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
