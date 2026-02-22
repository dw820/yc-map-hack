import React from "react";
import type { PointsListing } from "../types";
import { useListingSort } from "../hooks/useListingSort";
import { useListingFilter } from "../hooks/useListingFilter";
import { SortHeader } from "./SortHeader";
import { ListingRow } from "./ListingRow";
import { EmptyState } from "./EmptyState";

interface ListingsTableProps {
  listings: PointsListing[];
  onSelectListing: (listing: PointsListing) => void;
}

export const ListingsTable: React.FC<ListingsTableProps> = ({
  listings,
  onSelectListing,
}) => {
  const { filtered, filters, setFilters, airlines } =
    useListingFilter(listings);
  const { sorted, sortField, sortDirection, toggleSort } =
    useListingSort(filtered);

  const hasMultipleAirlines = airlines.length > 1;

  return (
    <div>
      {/* Filter bar */}
      {hasMultipleAirlines && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-subtle overflow-x-auto">
          <span className="text-xs text-secondary font-medium shrink-0">
            Airline:
          </span>
          <button
            className={`px-2.5 py-1 text-xs rounded-full transition-colors shrink-0 ${
              filters.airline === null
                ? "bg-info/10 text-info font-medium"
                : "text-secondary hover:bg-black/5 dark:hover:bg-white/5"
            }`}
            onClick={() => setFilters((f) => ({ ...f, airline: null }))}
          >
            All
          </button>
          {airlines.map((airline) => (
            <button
              key={airline}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors shrink-0 ${
                filters.airline === airline
                  ? "bg-info/10 text-info font-medium"
                  : "text-secondary hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              onClick={() => setFilters((f) => ({ ...f, airline }))}
            >
              {airline}
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
                label="Airline"
                field="airline"
                currentField={sortField}
                currentDirection={sortDirection}
                onSort={toggleSort}
              />
              <SortHeader
                label="Miles"
                field="milesAvailable"
                currentField={sortField}
                currentDirection={sortDirection}
                onSort={toggleSort}
              />
              <SortHeader
                label="$/Mile"
                field="pricePerMile"
                currentField={sortField}
                currentDirection={sortDirection}
                onSort={toggleSort}
              />
              <SortHeader
                label="Total"
                field="totalPrice"
                currentField={sortField}
                currentDirection={sortDirection}
                onSort={toggleSort}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((listing) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                onSelect={onSelectListing}
              />
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && <EmptyState />}
    </div>
  );
};
