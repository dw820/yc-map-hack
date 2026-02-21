import { z } from "zod";

export const flightSearchParamsSchema = z.object({
  origin: z.string().describe("Origin airport code (e.g. 'SFO')"),
  destination: z.string().describe("Destination airport code (e.g. 'TPE')"),
  departDate: z.string().describe("Departure date in YYYY-MM-DD format"),
  returnDate: z.string().optional().describe("Optional return date in YYYY-MM-DD format"),
  cabinClass: z
    .enum(["economy", "premium_economy", "business", "first"])
    .optional()
    .describe("Cabin class preference"),
  passengers: z
    .number()
    .min(1)
    .max(9)
    .optional()
    .describe("Number of passengers (1-9, default 1)"),
});

export type FlightSearchParams = z.infer<typeof flightSearchParamsSchema>;

export const flightResultSchema = z.object({
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
  cppRating: z
    .enum(["excellent", "good", "fair", "poor"])
    .nullable(),
  // Buy-miles pricing (computed from points marketplace)
  buyMilesRate: z.number().nullable(),
  buyMilesTotal: z.number().nullable(),
  buyMilesPlusTaxes: z.number().nullable(),
  // Deal analysis (computed)
  bestDeal: z.enum(["cash", "redeem", "buy"]).nullable(),
  savings: z.number().nullable(),
});

export type FlightResult = z.infer<typeof flightResultSchema>;

export const flightSearchResultSchema = z.object({
  flights: z.array(flightResultSchema),
  searchParams: flightSearchParamsSchema,
  provider: z.string(),
  timestamp: z.string(),
});

export type FlightSearchResult = z.infer<typeof flightSearchResultSchema>;
