"use client";

import { ArrowDownUp } from "lucide-react";
import Dropdown from "./Dropdown";

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
  return (
    <Dropdown
      value={value}
      options={options}
      onChange={onChange}
      ariaLabel={ariaLabel}
      icon={<ArrowDownUp className="h-3.5 w-3.5" />}
      className="min-w-52"
    />
  );
}
