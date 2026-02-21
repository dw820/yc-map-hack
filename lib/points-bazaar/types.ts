import { z } from "zod";

export const ListingSearchInputSchema = z.object({
  airline: z.string().default("all"),
  milesRange: z.string().default("unlimited"),
  unitPriceRange: z.string().default("unlimited"),
});

export type ListingSearchInput = z.infer<typeof ListingSearchInputSchema>;

export const RawPointsListingSchema = z.object({
  id: z.string(),
  airline: z.string(),
  loyaltyProgram: z.string().optional(),
  milesAvailable: z.number(),
  pricePerMile: z.number(),
  totalPrice: z.number().optional(),
  sellerDisplayName: z.string().optional(),
  sellerRating: z.number().optional(),
  listingStatus: z.string().default("active"),
  postedDate: z.string().optional(),
});

export type RawPointsListing = z.infer<typeof RawPointsListingSchema>;

export const ListingSearchResultSchema = z.object({
  listings: z.array(RawPointsListingSchema),
  searchInput: ListingSearchInputSchema,
  timestamp: z.string(),
  resultCount: z.number().int(),
});

export type ListingSearchResult = z.infer<typeof ListingSearchResultSchema>;
