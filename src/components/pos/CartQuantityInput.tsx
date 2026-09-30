import React, { useState, useEffect, useRef } from 'react';

interface CartQuantityInputProps {
  value: number;
  min?: number;
  max?: number;
  className?: string;
  onChange: (value: number) => void;
  ariaLabel?: string;
}

export const CartQuantityInput: React.FC<CartQuantityInputProps> = ({
  value,
  min = 1,
  max,
  className = '',
  onChange,
  ariaLabel = 'Quantity',
}) => {
  const [localValue, setLocalValue] = useState<string>(String(value));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    // Only synchronize from props if the user is not actively typing in this input
    if (!isFocusedRef.current) {
      setLocalValue(String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty string or digits only
    if (/^\d*$/.test(raw)) {
      setLocalValue(raw);
      if (raw !== '') {
        const num = parseInt(raw, 10);
        if (num >= min && (!max || num <= max)) {
          onChange(num);
        }
      }
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const num = parseInt(localValue, 10);
    if (isNaN(num) || num < min) {
      setLocalValue(String(min));
      onChange(min);
    } else if (max !== undefined && num > max) {
      setLocalValue(String(max));
      onChange(max);
    } else {
      setLocalValue(String(num));
      onChange(num);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={localValue}
      onFocus={(e) => {
        isFocusedRef.current = true;
        // Optionally select all on focus for fast replacement
        e.target.select();
      }}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onWheel={(e) => e.currentTarget.blur()}
      className={className}
      aria-label={ariaLabel}
    />
  );
};
