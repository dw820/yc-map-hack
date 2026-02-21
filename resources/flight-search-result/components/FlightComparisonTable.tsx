import React, { useState } from "react";
import type { FlightResult } from "../types";
import { useFlightSort } from "../hooks/useFlightSort";
import { useFlightFilter } from "../hooks/useFlightFilter";
import { SortHeader } from "./SortHeader";
import { FlightRow } from "./FlightRow";
import { SavingsBreakdown } from "./SavingsBreakdown";
import { EmptyState } from "./EmptyState";

interface FlightComparisonTableProps {
  flights: FlightResult[];
  onSelectFlight: (flight: FlightResult) => void;
}

export const FlightComparisonTable: React.FC<FlightComparisonTableProps> = ({
  flights,
  onSelectFlight,
}) => {
  const { filtered, filters, setFilters } = useFlightFilter(flights);
  const { sorted, sortField, sortDirection, toggleSort } = useFlightSort(filtered);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasStopVariety = flights.some((f) => f.stops > 0);

  const handleToggleExpand = (flight: FlightResult) => {
    setExpandedId((prev) => (prev === flight.id ? null : flight.id));
  };

  return (
    <div>
      {/* Filter bar */}
      {hasStopVariety && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-subtle">
          <span className="text-xs text-secondary font-medium">Stops:</span>
          {[
            { label: "All", value: null },
            { label: "Nonstop", value: 0 },
            { label: "1 stop", value: 1 },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                filters.maxStops === opt.value
                  ? "bg-info/10 text-info font-medium"
                  : "text-secondary hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              onClick={() =>
                setFilters((f) => ({ ...f, maxStops: opt.value }))
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-default">
              <SortHeader
                label="Date"
                field="departDate"
                currentField={sortField}
                currentDirection={sortDirection}
                onSort={toggleSort}
              />
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-secondary">
                Flight
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-secondary">
                Route
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-secondary">
                Depart
              </th>
              <SortHeader
                label="Cash"
                field="cashPrice"
                currentField={sortField}
                currentDirection={sortDirection}
                onSort={toggleSort}
              />
              <SortHeader
                label="Miles+Tax"
                field="milesPrice"
                currentField={sortField}
                currentDirection={sortDirection}
                onSort={toggleSort}
              />
              <SortHeader
                label="CPP"
                field="centsPerPoint"
                currentField={sortField}
                currentDirection={sortDirection}
                onSort={toggleSort}
              />
              <SortHeader
                label="Buy+Tax"
                field="buyMilesPlusTaxes"
                currentField={sortField}
                currentDirection={sortDirection}
                onSort={toggleSort}
              />
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-secondary">
                Best Deal
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((flight) => (
              <React.Fragment key={flight.id}>
                <FlightRow
                  flight={flight}
                  isExpanded={expandedId === flight.id}
                  onToggleExpand={handleToggleExpand}
                  onSelect={onSelectFlight}
                />
                {expandedId === flight.id && (
                  <tr>
                    <td
                      colSpan={9}
                      className="bg-surface-elevated/50 border-b border-subtle"
                    >
                      <SavingsBreakdown flight={flight} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && <EmptyState />}
    </div>
  );
};
