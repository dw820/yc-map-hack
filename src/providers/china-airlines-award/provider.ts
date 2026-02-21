import type { FlightResult, FlightSearchParams } from "../../schemas/flight.js";
import type { FlightProvider } from "../types.js";
import {
  searchAwardFlights,
  type AwardFlightOption,
} from "../../../lib/china-airlines-award/index.js";

export class ChinaAirlinesAwardProvider implements FlightProvider {
  name = "china-airlines-award";

  async search(params: FlightSearchParams): Promise<FlightResult[]> {
    const result = await searchAwardFlights({
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departDate,
      cabinClass: this.mapCabinClass(params.cabinClass),
      adults: params.passengers ?? 1,
    });

    return result.outbound.map((award, index) =>
      this.mapToFlightResult(award, params, index)
    );
  }

  private mapCabinClass(
    cabin?: string
  ): "economy" | "premium-economy" | "business" {
    switch (cabin) {
      case "premium_economy":
        return "premium-economy";
      case "business":
        return "business";
      case "first":
        return "business"; // Map first to business for China Airlines
      default:
        return "economy";
    }
  }

  private mapToFlightResult(
    award: AwardFlightOption,
    params: FlightSearchParams,
    index: number
  ): FlightResult {
    const firstSeg = award.segments[0];
    const lastSeg = award.segments[award.segments.length - 1];

    return {
      id: `award-${params.origin}-${params.destination}-${params.departDate}-${index}`,
      airline: firstSeg?.airline || "China Airlines",
      flightNumber: firstSeg?.flightNumber || "Unknown",
      origin: firstSeg?.departureAirport || params.origin,
      destination: lastSeg?.arrivalAirport || params.destination,
      departDate: params.departDate,
      departTime: firstSeg?.departureTime || "",
      arriveTime: lastSeg?.arrivalTime || "",
      duration: award.totalDuration || "",
      stops: award.stops,
      cabinClass: award.cabinClass,
      cashPrice: 0, // Award flights don't have a cash price
      cashCurrency: "USD",
      milesPrice: award.milesPrice ?? null,
      milesTaxes: award.taxesAndFees.amount ?? null,
      centsPerPoint: null, // Computed later by FlightSearchService
      cppRating: null,
      buyMilesRate: null,
      buyMilesTotal: null,
      buyMilesPlusTaxes: null,
      bestDeal: null,
      savings: null,
    };
  }
}
