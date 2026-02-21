import { z } from "zod";

const pointsListingSearchParamsSchema = z.object({
  airline: z.string().optional(),
  milesRange: z.string().optional(),
  unitPriceRange: z.string().optional(),
});

const pointsListingResultSchema = z.object({
  id: z.string(),
  airline: z.string(),
  loyaltyProgram: z.string().optional(),
  milesAvailable: z.number(),
  pricePerMile: z.number(),
  totalPrice: z.number().optional(),
  sellerDisplayName: z.string().optional(),
  sellerRating: z.number().optional(),
  listingStatus: z.string(),
  postedDate: z.string().optional(),
});

export const propSchema = z.object({
  listings: z.array(pointsListingResultSchema),
  searchParams: pointsListingSearchParamsSchema,
  provider: z.string(),
  timestamp: z.string(),
});

export type PointsListingSearchResultProps = z.infer<typeof propSchema>;
export type PointsListing = z.infer<typeof pointsListingResultSchema>;
