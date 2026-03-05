"use client";

import { useState, useRef, useEffect, useId, useCallback, type ReactNode } from "react";
import { MdExpandMore, MdCheck } from "react-icons/md";

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  icon?: ReactNode;
  className?: string;
}

export default function Dropdown({
  value,
  options,
  onChange,
  ariaLabel,
  icon,
  className = "",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setFocusIndex(-1);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setFocusIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Scroll focused option into view
  useEffect(() => {
    if (focusIndex < 0 || !listRef.current) return;
    const items = listRef.current.children;
    if (items[focusIndex]) {
      (items[focusIndex] as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }, [focusIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setFocusIndex(0);
        } else {
          setFocusIndex((prev) => Math.min(prev + 1, options.length - 1));
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) {
          setFocusIndex((prev) => Math.max(prev - 1, 0));
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open && focusIndex >= 0 && focusIndex < options.length) {
          onChange(options[focusIndex].value);
          close();
        } else if (!open) {
          setOpen(true);
          setFocusIndex(0);
        }
        break;
    }
  };

  const activeLabel = options.find((o) => o.value === value)?.label;

  return (
    <div ref={ref} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        onClick={() => {
          if (open) {
            setOpen(false);
            setFocusIndex(-1);
          } else {
            setOpen(true);
            setFocusIndex(options.findIndex((o) => o.value === value));
          }
        }}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-full border border-stone-300 bg-white px-4 text-sm text-stone-700 transition-colors hover:bg-stone-50"
        aria-label={activeLabel ? `${ariaLabel}: ${activeLabel}` : ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? menuId : undefined}
      >
        <span className="flex items-center gap-2">
          {icon && (
            <span className="text-stone-400">{icon}</span>
          )}
          <span>{activeLabel}</span>
        </span>
        <MdExpandMore
          className={`h-3.5 w-3.5 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          ref={listRef}
          id={menuId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 z-20 mt-1.5 min-w-full overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-lg"
        >
          {options.map((opt, i) => (
            <button
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              onClick={() => {
                onChange(opt.value);
                close();
              }}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors ${
                i === focusIndex ? "bg-stone-100" : ""
              } ${
                value === opt.value
                  ? "font-semibold text-brand-orange-text"
                  : "text-stone-700 hover:bg-stone-50"
              }`}
            >
              <MdCheck
                className={`h-3.5 w-3.5 shrink-0 ${value === opt.value ? "text-brand-orange-text" : "invisible"}`}
              />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
