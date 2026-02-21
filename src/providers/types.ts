import type { FlightResult, FlightSearchParams } from "../schemas/flight.js";
import type {
  PointsListingResult,
  PointsListingSearchParams,
} from "../schemas/points-listing.js";

export interface FlightProvider {
  name: string;
  search(params: FlightSearchParams): Promise<FlightResult[]>;
}

export interface PointsListingProvider {
  name: string;
  searchListings(
    params: PointsListingSearchParams
  ): Promise<PointsListingResult[]>;
}
