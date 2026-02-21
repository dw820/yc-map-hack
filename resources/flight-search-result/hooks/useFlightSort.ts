import { useState, useMemo } from "react";
import type { FlightResult } from "../types";

export type SortField =
  | "departDate"
  | "cashPrice"
  | "milesPrice"
  | "centsPerPoint"
  | "buyMilesPlusTaxes"
  | "duration"
  | "stops";
export type SortDirection = "asc" | "desc";

export function useFlightSort(flights: FlightResult[]) {
  const [sortField, setSortField] = useState<SortField>("departDate");
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
    const copy = [...flights];
    copy.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortField) {
        case "departDate":
          aVal = new Date(a.departDate).getTime();
          bVal = new Date(b.departDate).getTime();
          break;
        case "cashPrice":
          aVal = a.cashPrice;
          bVal = b.cashPrice;
          break;
        case "milesPrice":
          aVal = a.milesPrice ?? Infinity;
          bVal = b.milesPrice ?? Infinity;
          break;
        case "centsPerPoint":
          aVal = a.centsPerPoint ?? -1;
          bVal = b.centsPerPoint ?? -1;
          break;
        case "buyMilesPlusTaxes":
          aVal = a.buyMilesPlusTaxes ?? Infinity;
          bVal = b.buyMilesPlusTaxes ?? Infinity;
          break;
        case "duration": {
          aVal = parseDuration(a.duration);
          bVal = parseDuration(b.duration);
          break;
        }
        case "stops":
          aVal = a.stops;
          bVal = b.stops;
          break;
        default:
          return 0;
      }

      const diff = aVal - bVal;
      return sortDirection === "asc" ? diff : -diff;
    });
    return copy;
  }, [flights, sortField, sortDirection]);

  return { sorted, sortField, sortDirection, toggleSort };
}

function parseDuration(d: string): number {
  const hours = d.match(/(\d+)h/);
  const mins = d.match(/(\d+)m/);
  return (hours ? parseInt(hours[1]) * 60 : 0) + (mins ? parseInt(mins[1]) : 0);
}
