"use client";

import { cn, faStr, sanitizeFaNumericInput, withRtlMark, type FaNumericAllow } from "@/lib";

const INPUT_MODE = {
  digits: "numeric",
  decimal: "decimal",
  time: "numeric",
  phone: "tel",
} as const;

/**
 * RTL numeric field: Persian digits on screen, ASCII in onChange.
 * Fills from the right so values like ۸ or ۰۸:۰۰ sit on the trailing edge.
 */
export function FaInput({
  value,
  onChange,
  placeholder,
  allow = "digits",
  className,
  disabled,
  onBlur,
  ...rest
}: {
  value: string | number;
  onChange: (ascii: string) => void;
  placeholder?: string;
  allow?: FaNumericAllow;
  className?: string;
  disabled?: boolean;
  onBlur?: (ascii: string) => void;
  "data-testid"?: string;
  "aria-label"?: string;
}) {
  const ascii = String(value ?? "");
  const shown = ascii ? withRtlMark(faStr(ascii)) : "";

  return (
    <input
      dir="rtl"
      inputMode={INPUT_MODE[allow]}
      placeholder={placeholder ? faStr(placeholder) : undefined}
      value={shown}
      disabled={disabled}
      onChange={(e) => onChange(sanitizeFaNumericInput(e.target.value, allow))}
      onBlur={onBlur ? () => onBlur(ascii) : undefined}
      className={cn(
        "h-10 rounded-md border border-line px-3 text-right text-[12px] outline-none focus:border-ink",
        className,
      )}
      {...rest}
    />
  );
}
