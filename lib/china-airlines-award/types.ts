import { z } from "zod";

export const CabinClassSchema = z.enum([
  "economy",
  "premium-economy",
  "business",
]);
export type CabinClass = z.infer<typeof CabinClassSchema>;

export const AwardSearchInputSchema = z.object({
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
export type AwardSearchInput = z.infer<typeof AwardSearchInputSchema>;

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

export const AwardFlightOptionSchema = z.object({
  segments: z.array(FlightSegmentSchema),
  totalDuration: z.string().optional(),
  stops: z.number().int().min(0),
  milesPrice: z.number().optional(),
  taxesAndFees: z.object({
    amount: z.number().optional(),
    currency: z.string().default("USD"),
    displayText: z.string(),
  }),
  seatAvailability: z.number().optional(),
  bookingClass: z.string().optional(),
  fareFamily: z.string().optional(),
  cabinClass: z.string(),
});
export type AwardFlightOption = z.infer<typeof AwardFlightOptionSchema>;

export const AwardSearchResultSchema = z.object({
  outbound: z.array(AwardFlightOptionSchema),
  searchInput: AwardSearchInputSchema,
  timestamp: z.string(),
  resultCount: z.number().int(),
});
export type AwardSearchResult = z.infer<typeof AwardSearchResultSchema>;

export const LoginResultSchema = z.object({
  success: z.boolean(),
  debugUrl: z.string().optional(),
  sessionId: z.string().optional(),
  contextId: z.string().optional(),
  message: z.string(),
});
export type LoginResult = z.infer<typeof LoginResultSchema>;
