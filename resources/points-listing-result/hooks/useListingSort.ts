import { useState, useMemo } from "react";
import type { PointsListing } from "../types";

export type SortField =
  | "pricePerMile"
  | "milesAvailable"
  | "totalPrice"
  | "airline";
export type SortDirection = "asc" | "desc";

export function useListingSort(listings: PointsListing[]) {
  const [sortField, setSortField] = useState<SortField>("pricePerMile");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sorted = useMemo(() => {
    const copy = [...listings];
    copy.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "pricePerMile":
          aVal = a.pricePerMile;
          bVal = b.pricePerMile;
          break;
        case "milesAvailable":
          aVal = a.milesAvailable;
          bVal = b.milesAvailable;
          break;
        case "totalPrice":
          aVal = a.totalPrice ?? Infinity;
          bVal = b.totalPrice ?? Infinity;
          break;
        case "airline":
          aVal = a.airline;
          bVal = b.airline;
          break;
      }

      let diff: number;
      if (typeof aVal === "string" && typeof bVal === "string") {
        diff = aVal.localeCompare(bVal);
      } else {
        diff = (aVal as number) - (bVal as number);
      }
      return sortDirection === "asc" ? diff : -diff;
    });
    return copy;
  }, [listings, sortField, sortDirection]);

  return { sorted, sortField, sortDirection, toggleSort };
}
