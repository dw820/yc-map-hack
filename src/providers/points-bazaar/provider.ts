import type { PointsListingResult, PointsListingSearchParams } from "../../schemas/points-listing.js";
import type { PointsListingProvider } from "../types.js";
import { searchListings } from "../../../lib/points-bazaar/index.js";

export class PointsBazaarProvider implements PointsListingProvider {
  name = "points-bazaar";

  async searchListings(
    params: PointsListingSearchParams
  ): Promise<PointsListingResult[]> {
    const result = await searchListings({
      airline: params.airline || "all",
      milesRange: params.milesRange || "unlimited",
      unitPriceRange: params.unitPriceRange || "unlimited",
    });

    return result.listings.map((listing) => ({
      id: listing.id,
      airline: listing.airline,
      loyaltyProgram: listing.loyaltyProgram,
      milesAvailable: listing.milesAvailable,
      pricePerMile: listing.pricePerMile,
      totalPrice: listing.totalPrice,
      sellerDisplayName: listing.sellerDisplayName,
      sellerRating: listing.sellerRating,
      listingStatus: listing.listingStatus,
      postedDate: listing.postedDate,
    }));
  }
}
