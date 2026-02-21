import { z } from "zod";

const flightSearchParamsSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  departDate: z.string(),
  returnDate: z.string().optional(),
  cabinClass: z.enum(["economy", "premium_economy", "business", "first"]).optional(),
  passengers: z.number().optional(),
});

const flightResultSchema = z.object({
  id: z.string(),
  airline: z.string(),
  flightNumber: z.string(),
  origin: z.string(),
  destination: z.string(),
  departDate: z.string(),
  departTime: z.string(),
  arriveTime: z.string(),
  duration: z.string(),
  stops: z.number(),
  cabinClass: z.string(),
  cashPrice: z.number(),
  cashCurrency: z.string(),
  milesPrice: z.number().nullable(),
  milesTaxes: z.number().nullable(),
  centsPerPoint: z.number().nullable(),
  cppRating: z.enum(["excellent", "good", "fair", "poor"]).nullable(),
  buyMilesRate: z.number().nullable(),
  buyMilesTotal: z.number().nullable(),
  buyMilesPlusTaxes: z.number().nullable(),
  bestDeal: z.enum(["cash", "redeem", "buy"]).nullable(),
  savings: z.number().nullable(),
});

export const propSchema = z.object({
  flights: z.array(flightResultSchema),
  searchParams: flightSearchParamsSchema,
  provider: z.string(),
  timestamp: z.string(),
});

export type FlightSearchResultProps = z.infer<typeof propSchema>;
export type FlightResult = z.infer<typeof flightResultSchema>;
