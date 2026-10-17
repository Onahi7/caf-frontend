import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, UserPlus, X } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { buildApiUrl } from '../../lib/api-utils';
import { useDebounce } from '../../hooks/useDebounce';

export interface CustomerOption {
  _id: string;
  name: string;
  phone: string;
  email?: string;
}

interface CustomerTypeaheadProps {
  value: string;
  onChange: (value: string) => void;
  onSelectCustomer?: (customer: CustomerOption) => void;
  onClearCustomer?: () => void;
  selectedCustomerId?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  className?: string;
  allowFreeText?: boolean;
}

export function CustomerTypeahead({
  value,
  onChange,
  onSelectCustomer,
  onClearCustomer,
  selectedCustomerId,
  placeholder = 'Search customer or type a name...',
  required,
  disabled,
  label,
  helperText,
  className = '',
  allowFreeText = true,
}: CustomerTypeaheadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const debouncedSearch = useDebounce(value, 250);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const shouldSearch = isOpen && debouncedSearch.length >= 1;
  const { data, isLoading } = useQuery({
    queryKey: ['customer-typeahead', debouncedSearch],
    queryFn: async () => {
      const res = await apiClient.get(
        buildApiUrl('/customers', { search: debouncedSearch, limit: '8' }),
      );
      const list = (res.data?.data ?? res.data ?? []) as CustomerOption[];
      return list;
    },
    enabled: shouldSearch,
    staleTime: 30_000,
  });

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    setHighlighted(0);
  }, [debouncedSearch]);

  const options = data ?? [];
  const showDropdown = isOpen && (options.length > 0 || isLoading);

  const handleSelect = (c: CustomerOption) => {
    onChange(c.name);
    onSelectCustomer?.(c);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange('');
    onClearCustomer?.();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[highlighted]) handleSelect(options[highlighted]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-white mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
          {selectedCustomerId && (
            <span className="ml-2 inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
              <UserPlus className="h-3 w-3 mr-1" />
              Linked
            </span>
          )}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
            if (selectedCustomerId) onClearCustomer?.();
          }}
          onFocus={() => {
            if (value.length >= 1) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-2.5 pr-16 rounded-xl bg-white/5 text-white border border-white/10 focus:border-emerald-500/50 focus:outline-none placeholder:text-slate-500"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="rounded p-1 text-slate-400 hover:text-white hover:bg-white/10"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>
      {helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}

      {showDropdown ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/40">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-slate-400">Searching customers...</div>
          ) : options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">
              No matches.{allowFreeText ? ' Press Enter to use as a walk-in name.' : ''}
            </div>
          ) : (
            <ul className="max-h-56 overflow-y-auto" role="listbox">
              {options.map((c, i) => (
                <li
                  key={c._id}
                  role="option"
                  aria-selected={i === highlighted}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(c);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`flex cursor-pointer items-center justify-between gap-3 border-b border-white/5 px-4 py-2 last:border-0 ${
                    i === highlighted ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{c.name}</p>
                    <p className="truncate text-xs text-slate-400">{c.phone}{c.email ? ` - ${c.email}` : ''}</p>
                  </div>
                  <UserPlus className="h-4 w-4 shrink-0 text-emerald-500" />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
