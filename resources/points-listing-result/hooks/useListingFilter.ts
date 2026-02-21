import { useState, useMemo } from "react";
import type { PointsListing } from "../types";

export interface ListingFilters {
  airline: string | null;
}

export function useListingFilter(listings: PointsListing[]) {
  const [filters, setFilters] = useState<ListingFilters>({
    airline: null,
  });

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (filters.airline && l.airline !== filters.airline) return false;
      return true;
    });
  }, [listings, filters]);

  const airlines = useMemo(() => {
    const unique = new Set(listings.map((l) => l.airline));
    return Array.from(unique).sort();
  }, [listings]);

  return { filtered, filters, setFilters, airlines };
}
