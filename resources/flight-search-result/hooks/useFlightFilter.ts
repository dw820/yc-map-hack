import { useState, useMemo } from "react";
import type { FlightResult } from "../types";

export interface FlightFilters {
  cabinClass: string | null;
  maxStops: number | null;
}

export function useFlightFilter(flights: FlightResult[]) {
  const [filters, setFilters] = useState<FlightFilters>({
    cabinClass: null,
    maxStops: null,
  });

  const filtered = useMemo(() => {
    return flights.filter((f) => {
      if (filters.cabinClass && f.cabinClass !== filters.cabinClass) return false;
      if (filters.maxStops != null && f.stops > filters.maxStops) return false;
      return true;
    });
  }, [flights, filters]);

  return { filtered, filters, setFilters };
}
