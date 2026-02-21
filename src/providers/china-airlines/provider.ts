import type { FlightResult, FlightSearchParams } from "../../schemas/flight.js";
import type { FlightProvider } from "../types.js";
import {
  searchFlights,
  type FlightOption,
} from "../../../lib/china-airlines/index.js";

// Hardcoded TWD→USD rate. Replace with a live exchange rate API when available.
const TWD_TO_USD = 0.031;

function cleanAirlineName(raw: string): string {
  // "CHINA AIRLINES LTD." → "China Airlines"
  return raw
    .replace(/\bLTD\.?$/i, "")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapFlightOption(
  option: FlightOption,
  params: FlightSearchParams
): FlightResult {
  const firstSeg = option.segments[0];
  const lastSeg = option.segments[option.segments.length - 1];

  const isNonUsd =
    option.price.currency && option.price.currency.toUpperCase() !== "USD";
  const cashPrice =
    isNonUsd && option.price.amount != null
      ? Math.round(option.price.amount * TWD_TO_USD)
      : (option.price.amount ?? 0);

  return {
    id: `ci-${firstSeg.flightNumber}-${params.departDate}`,
    airline: cleanAirlineName(firstSeg.airline),
    flightNumber: firstSeg.flightNumber,
    origin: firstSeg.departureAirport,
    destination: lastSeg.arrivalAirport,
    departDate: params.departDate,
    departTime: firstSeg.departureTime,
    arriveTime: lastSeg.arrivalTime,
    duration: option.totalDuration ?? "",
    stops: option.stops,
    cabinClass: option.cabinClass.toLowerCase(),
    cashPrice,
    cashCurrency: "USD",
    milesPrice: null,
    milesTaxes: null,
    centsPerPoint: null,
    cppRating: null,
    buyMilesRate: null,
    buyMilesTotal: null,
    buyMilesPlusTaxes: null,
    bestDeal: null,
    savings: null,
  };
}

export class ChinaAirlinesProvider implements FlightProvider {
  name = "china-airlines";

  async search(params: FlightSearchParams): Promise<FlightResult[]> {
    const cabinMap: Record<string, string> = {
      economy: "economy",
      premium_economy: "premium-economy",
      business: "business",
    };

    const result = await searchFlights({
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departDate,
      cabinClass: (cabinMap[params.cabinClass ?? "economy"] ??
        "economy") as "economy" | "premium-economy" | "business",
      adults: params.passengers ?? 1,
    });

    return result.outbound.map((option) => mapFlightOption(option, params));
  }
}
