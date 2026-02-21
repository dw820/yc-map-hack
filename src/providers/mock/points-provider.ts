import type { PointsListingResult, PointsListingSearchParams } from "../../schemas/points-listing.js";
import type { PointsListingProvider } from "../types.js";
import { generateMockPointsListings } from "./points-data.js";

export class MockPointsListingProvider implements PointsListingProvider {
  name = "mock";

  async searchListings(
    params: PointsListingSearchParams
  ): Promise<PointsListingResult[]> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return generateMockPointsListings(params.airline);
  }
}
