"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowDownUp, ChevronDown, Check } from "lucide-react";

interface SortOption {
  value: string;
  label: string;
}

interface SortDropdownProps {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
}

export default function SortDropdown({
  value,
  options,
  onChange,
  ariaLabel,
}: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeLabel = options.find((o) => o.value === value)?.label;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 min-w-52 items-center justify-between gap-2 rounded-full border border-stone-300 bg-white px-4 text-sm text-stone-700 transition-colors hover:bg-stone-50"
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <ArrowDownUp className="h-3.5 w-3.5 text-stone-400" />
          <span>{activeLabel}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1.5 min-w-full overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors ${
                value === opt.value
                  ? "font-semibold text-brand-orange"
                  : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              <Check
                className={`h-3.5 w-3.5 shrink-0 ${value === opt.value ? "text-brand-orange" : "invisible"}`}
              />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
