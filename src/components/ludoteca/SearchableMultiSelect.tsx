"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

interface SearchableMultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  selectedLabel: (count: number) => string;
  label: string;
}

export default function SearchableMultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder,
  selectedLabel,
  label,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [focusIndex, setFocusIndex] = useState(-1);

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on scroll outside the dropdown
  useEffect(() => {
    if (!open) return;
    const handler = (e: WheelEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("wheel", handler, { passive: true });
    return () => document.removeEventListener("wheel", handler);
  }, [open]);

  // Focus search input when opening
  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
      setFocusIndex(-1);
    } else {
      setQuery("");
    }
  }, [open]);

  const toggle = useCallback(
    (value: string) => {
      onChange(
        selected.includes(value)
          ? selected.filter((v) => v !== value)
          : [...selected, value]
      );
    },
    [selected, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (focusIndex >= 0 && focusIndex < filtered.length) {
          toggle(filtered[focusIndex]);
        }
        break;
    }
  };

  // Scroll focused option into view
  useEffect(() => {
    if (focusIndex < 0 || !listRef.current) return;
    const items = listRef.current.children;
    if (items[focusIndex]) {
      (items[focusIndex] as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }, [focusIndex]);

  // Reset focus index when filtered list changes
  useEffect(() => {
    setFocusIndex(-1);
  }, [query]);

  if (options.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm transition-colors ${
          selected.length > 0
            ? "border-brand-orange bg-brand-orange/5 text-stone-800"
            : "border-stone-300 bg-white text-stone-500"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="truncate">
          {selected.length > 0
            ? selectedLabel(selected.length)
            : placeholder}
        </span>
        <ChevronDown
          className={`ml-2 h-4 w-4 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg"
          data-lenis-prevent
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="border-b border-stone-100 p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 w-full rounded-md border border-stone-200 bg-stone-50 pl-8 pr-3 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-brand-orange"
                aria-label={searchPlaceholder}
              />
            </div>
          </div>

          {/* Options list */}
          <ul
            ref={listRef}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="max-h-60 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-center text-sm text-stone-400">
                —
              </li>
            ) : (
              filtered.map((option, i) => {
                const isSelected = selected.includes(option);
                const isFocused = i === focusIndex;
                return (
                  <li
                    key={option}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(option)}
                    className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                      isFocused
                        ? "bg-stone-100"
                        : "hover:bg-stone-50"
                    } ${isSelected ? "font-medium text-stone-800" : "text-stone-600"}`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? "border-brand-orange bg-brand-orange text-white"
                          : "border-stone-300 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate">{option}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
