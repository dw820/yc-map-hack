import type { FlightResult, FlightSearchParams } from "../../schemas/flight.js";
import type { FlightProvider } from "../types.js";
import { generateMockFlights } from "./data.js";

export class MockFlightProvider implements FlightProvider {
  name = "mock";

  async search(params: FlightSearchParams): Promise<FlightResult[]> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return generateMockFlights(
      params.origin,
      params.destination,
      params.departDate,
      params.cabinClass
    );
  }
}
