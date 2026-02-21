import { z } from "zod";

export const CabinClassSchema = z.enum([
  "economy",
  "premium-economy",
  "business",
]);
export type CabinClass = z.infer<typeof CabinClassSchema>;

export const FlightSearchInputSchema = z.object({
  origin: z
    .string()
    .length(3, "Origin must be a 3-letter IATA code")
    .toUpperCase(),
  destination: z
    .string()
    .length(3, "Destination must be a 3-letter IATA code")
    .toUpperCase(),
  departureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  cabinClass: CabinClassSchema.default("economy"),
  adults: z.number().int().min(1).max(9).default(1),
});
export type FlightSearchInput = z.infer<typeof FlightSearchInputSchema>;

export const FlightSegmentSchema = z.object({
  flightNumber: z.string(),
  airline: z.string().default("China Airlines"),
  departureAirport: z.string(),
  arrivalAirport: z.string(),
  departureTime: z.string(),
  arrivalTime: z.string(),
  duration: z.string().optional(),
  aircraft: z.string().optional(),
});
export type FlightSegment = z.infer<typeof FlightSegmentSchema>;

export const FlightOptionSchema = z.object({
  segments: z.array(FlightSegmentSchema),
  totalDuration: z.string().optional(),
  stops: z.number().int().min(0),
  price: z.object({
    amount: z.number().optional(),
    currency: z.string().default("USD"),
    displayText: z.string(),
  }),
  cabinClass: z.string(),
  fareType: z.string().optional(),
});
export type FlightOption = z.infer<typeof FlightOptionSchema>;

export const FlightSearchResultSchema = z.object({
  outbound: z.array(FlightOptionSchema),
  searchInput: FlightSearchInputSchema,
  timestamp: z.string(),
  resultCount: z.number().int(),
});
export type FlightSearchResult = z.infer<typeof FlightSearchResultSchema>;
