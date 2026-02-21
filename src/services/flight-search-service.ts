import type { FlightProvider } from "../providers/types.js";
import type {
  FlightResult,
  FlightSearchParams,
  FlightSearchResult,
} from "../schemas/flight.js";
import { calculateCpp, getCppRating } from "../utils/cpp.js";

const cache = new Map<string, { data: FlightSearchResult; expires: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function cacheKey(params: FlightSearchParams): string {
  return JSON.stringify({
    o: params.origin,
    d: params.destination,
    dd: params.departDate,
    rd: params.returnDate,
    c: params.cabinClass,
    p: params.passengers,
  });
}

function enrichWithCpp(flight: FlightResult): FlightResult {
  const cpp = calculateCpp(flight.cashPrice, flight.milesPrice, flight.milesTaxes);
  return {
    ...flight,
    centsPerPoint: cpp != null ? Math.round(cpp * 100) / 100 : null,
    cppRating: getCppRating(cpp),
  };
}

export class FlightSearchService {
  constructor(private provider: FlightProvider) {}

  async search(params: FlightSearchParams): Promise<FlightSearchResult> {
    const key = cacheKey(params);
    const cached = cache.get(key);

    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const rawFlights = await this.provider.search(params);
    const flights = rawFlights.map(enrichWithCpp);

    const result: FlightSearchResult = {
      flights,
      searchParams: params,
      provider: this.provider.name,
      timestamp: new Date().toISOString(),
    };

    cache.set(key, { data: result, expires: Date.now() + CACHE_TTL });

    return result;
  }

  getFlightById(flightId: string): FlightResult | undefined {
    for (const entry of cache.values()) {
      const found = entry.data.flights.find((f) => f.id === flightId);
      if (found) return found;
    }
    return undefined;
  }
}
