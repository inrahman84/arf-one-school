import React, { useState } from 'react';
import { formatDirectNumber, parseDirectNumber, sanitizeDirectNumber } from '../../lib/directNumberEntry';

type DirectNumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'inputMode' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'> & {
  value: number;
  onValueChange: (value: number) => void;
  currency?: boolean;
  allowDecimal?: boolean;
  min?: number;
  max?: number;
};

/**
 * Type digits directly, including when an existing field contains zero.
 * The browser's up/down number controls are intentionally not used.
 * Currency grouping only appears once editing has finished.
 */
export const DirectNumberInput: React.FC<DirectNumberInputProps> = ({
  value, onValueChange, currency = false, allowDecimal = false, min, max,
  onFocus, onBlur, placeholder = 'Ketik angka', ...props
}) => {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const validValue = Number.isFinite(value) ? value : 0;
  const displayed = focused ? draft : formatDirectNumber(validValue, currency);

  return <input {...props}
    type="text"
    inputMode={allowDecimal ? 'decimal' : 'numeric'}
    autoComplete="off"
    placeholder={placeholder}
    value={displayed}
    onFocus={event => {
      setDraft(validValue === 0 ? '' : String(validValue));
      setFocused(true);
      const input = event.currentTarget;
      input.select();
      // React updates the displayed value from e.g. 125.000 to 125000 on focus.
      // Select again after that render, so the first typed digit replaces the
      // old amount rather than being appended to it.
      requestAnimationFrame(() => {
        if (document.activeElement === input) input.select();
      });
      onFocus?.(event);
    }}
    onChange={event => {
      const cleaned = sanitizeDirectNumber(event.target.value, allowDecimal);
      const parsed = parseDirectNumber(cleaned);
      if (parsed === null) return;
      setDraft(cleaned);
      onValueChange(parsed);
    }}
    onBlur={event => {
      setFocused(false);
      if (min !== undefined && validValue < min) onValueChange(min);
      if (max !== undefined && validValue > max) onValueChange(max);
      onBlur?.(event);
    }}
  />;
};
