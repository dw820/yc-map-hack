import type { PointsListingProvider } from "../providers/types.js";
import type {
  PointsListingResult,
  PointsListingSearchParams,
  PointsListingSearchResult,
} from "../schemas/points-listing.js";

const cache = new Map<
  string,
  { data: PointsListingSearchResult; expires: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (listings change more frequently)

function cacheKey(params: PointsListingSearchParams): string {
  return JSON.stringify({
    a: params.airline,
    mr: params.milesRange,
    upr: params.unitPriceRange,
  });
}

export class PointsListingService {
  constructor(private provider: PointsListingProvider) {}

  async search(
    params: PointsListingSearchParams
  ): Promise<PointsListingSearchResult> {
    const key = cacheKey(params);
    const cached = cache.get(key);

    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const listings = await this.provider.searchListings(params);

    const result: PointsListingSearchResult = {
      listings,
      searchParams: params,
      provider: this.provider.name,
      timestamp: new Date().toISOString(),
    };

    cache.set(key, { data: result, expires: Date.now() + CACHE_TTL });

    return result;
  }

  getListingById(listingId: string): PointsListingResult | undefined {
    for (const entry of cache.values()) {
      const found = entry.data.listings.find((l) => l.id === listingId);
      if (found) return found;
    }
    return undefined;
  }
}
