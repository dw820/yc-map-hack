import type { FlightProvider, PointsListingProvider } from "../providers/types.js";
import type {
  FlightResult,
  FlightSearchParams,
  FlightSearchResult,
} from "../schemas/flight.js";
import type { PointsListingResult } from "../schemas/points-listing.js";
import { calculateCpp, getCppRating } from "../utils/cpp.js";

const cache = new Map<string, { data: FlightSearchResult; expires: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function cacheKey(params: FlightSearchParams): string {
  return `unified:${JSON.stringify({
    o: params.origin,
    d: params.destination,
    dd: params.departDate,
    rd: params.returnDate,
    c: params.cabinClass,
    p: params.passengers,
  })}`;
}

function enrichWithCpp(flight: FlightResult): FlightResult {
  const cpp = calculateCpp(flight.cashPrice, flight.milesPrice, flight.milesTaxes);
  return {
    ...flight,
    centsPerPoint: cpp != null ? Math.round(cpp * 100) / 100 : null,
    cppRating: getCppRating(cpp),
  };
}

function normalizeFlightNumber(fn: string): string {
  return fn.replace(/\s+/g, "").toUpperCase();
}

function mergeFlights(
  cashFlights: FlightResult[],
  awardFlights: FlightResult[]
): FlightResult[] {
  return cashFlights.map((cash) => {
    // If cash flight already has miles data (e.g. mock mode), keep it
    if (cash.milesPrice != null) return cash;

    // Find matching award flight by normalized flightNumber + departDate
    const award = awardFlights.find(
      (a) =>
        normalizeFlightNumber(a.flightNumber) === normalizeFlightNumber(cash.flightNumber) &&
        a.departDate === cash.departDate
    );

    if (!award || award.milesPrice == null) return cash;

    return {
      ...cash,
      milesPrice: award.milesPrice,
      milesTaxes: award.milesTaxes,
    };
  });
}

function findBestRate(
  milesNeeded: number,
  listings: PointsListingResult[]
): number | null {
  const eligible = listings.filter((l) => l.milesAvailable >= milesNeeded);
  if (eligible.length === 0) return null;
  return Math.min(...eligible.map((l) => l.pricePerMile));
}

function computeBuyMilesAndBestDeal(
  flight: FlightResult,
  listings: PointsListingResult[]
): FlightResult {
  if (flight.milesPrice == null) {
    // No miles option — cash is the only choice
    return { ...flight, bestDeal: "cash", savings: null };
  }

  const bestRate = findBestRate(flight.milesPrice, listings);
  const milesTaxes = flight.milesTaxes ?? 0;

  let buyMilesRate: number | null = null;
  let buyMilesTotal: number | null = null;
  let buyMilesPlusTaxes: number | null = null;

  if (bestRate != null) {
    buyMilesRate = bestRate;
    buyMilesTotal = Math.round(flight.milesPrice * bestRate * 100) / 100;
    buyMilesPlusTaxes = Math.round((buyMilesTotal + milesTaxes) * 100) / 100;
  }

  // Determine best deal
  let bestDeal: "cash" | "redeem" | "buy" = "cash";
  let savings: number | null = null;

  if (buyMilesPlusTaxes != null && buyMilesPlusTaxes < flight.cashPrice) {
    bestDeal = "buy";
    savings = Math.round((flight.cashPrice - buyMilesPlusTaxes) * 100) / 100;
  } else if (flight.milesPrice != null && buyMilesPlusTaxes == null) {
    // Has miles option but can't buy miles — recommend redeem for users who have miles
    bestDeal = "redeem";
  }

  return {
    ...flight,
    buyMilesRate,
    buyMilesTotal,
    buyMilesPlusTaxes,
    bestDeal,
    savings,
  };
}

export class UnifiedFlightSearchService {
  constructor(
    private cashProvider: FlightProvider,
    private awardProvider: FlightProvider,
    private pointsProvider: PointsListingProvider
  ) {}

  async search(params: FlightSearchParams): Promise<FlightSearchResult> {
    const key = cacheKey(params);
    const cached = cache.get(key);

    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    // All 3 providers in parallel:
    // - Cash: creates its own Browserbase session
    // - Award: reconnects to existing keepAlive session
    // - Points: uses Firecrawl (no Browserbase)
    const [cashFlights, awardFlights, listings] = await Promise.all([
      this.cashProvider.search(params),
      this.awardProvider.search(params).catch((err) => {
        console.warn("Award search failed, continuing without award data:", err);
        return [] as FlightResult[];
      }),
      this.pointsProvider
        .searchListings({ airline: "CI" })
        .catch((err) => {
          console.warn("Points listing search failed, continuing without marketplace data:", err);
          return [] as PointsListingResult[];
        }),
    ]);

    // Merge cash + award by flightNumber + departDate
    const merged = mergeFlights(cashFlights, awardFlights);

    // Enrich with CPP, then compute buy-miles pricing and best deal
    const flights = merged
      .map(enrichWithCpp)
      .map((f) => computeBuyMilesAndBestDeal(f, listings));

    const result: FlightSearchResult = {
      flights,
      searchParams: params,
      provider: this.cashProvider.name,
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
