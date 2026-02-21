import React from "react";
import type { SortDirection, SortField } from "../hooks/useFlightSort";

interface SortHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}

export const SortHeader: React.FC<SortHeaderProps> = ({
  label,
  field,
  currentField,
  currentDirection,
  onSort,
  className = "",
}) => {
  const isActive = currentField === field;
  const arrow = isActive ? (currentDirection === "asc" ? " \u2191" : " \u2193") : "";

  return (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
        isActive ? "text-info" : "text-secondary"
      } ${className}`}
      onClick={() => onSort(field)}
    >
      {label}
      {arrow}
    </th>
  );
};
