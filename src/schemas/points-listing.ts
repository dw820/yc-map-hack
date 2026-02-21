import { z } from "zod";

export const pointsListingSearchParamsSchema = z.object({
  airline: z
    .string()
    .optional()
    .describe(
      "Airline IATA code (e.g. 'CI', 'AA', 'UA') or omit for all airlines"
    ),
  milesRange: z
    .string()
    .optional()
    .describe("Miles quantity range filter (default: unlimited)"),
  unitPriceRange: z
    .string()
    .optional()
    .describe("Price per mile range filter (default: unlimited)"),
});

export type PointsListingSearchParams = z.infer<
  typeof pointsListingSearchParamsSchema
>;

export const pointsListingResultSchema = z.object({
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

export type PointsListingResult = z.infer<typeof pointsListingResultSchema>;

export const pointsListingSearchResultSchema = z.object({
  listings: z.array(pointsListingResultSchema),
  searchParams: pointsListingSearchParamsSchema,
  provider: z.string(),
  timestamp: z.string(),
});

export type PointsListingSearchResult = z.infer<
  typeof pointsListingSearchResultSchema
>;
