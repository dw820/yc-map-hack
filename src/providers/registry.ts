import type { FlightProvider, PointsListingProvider } from "./types.js";
import { MockFlightProvider } from "./mock/provider.js";
import { ChinaAirlinesProvider } from "./china-airlines/provider.js";
import { ChinaAirlinesAwardProvider } from "./china-airlines-award/provider.js";
import { MockPointsListingProvider } from "./mock/points-provider.js";
import { PointsBazaarProvider } from "./points-bazaar/provider.js";

export function createProvider(): FlightProvider {
  const mode = process.env.DATA_MODE || "mock";

  if (mode === "mock") {
    return new MockFlightProvider();
  }

  return new ChinaAirlinesProvider();
}

export function createPointsListingProvider(): PointsListingProvider {
  const mode = process.env.DATA_MODE || "mock";

  if (mode === "mock") {
    return new MockPointsListingProvider();
  }

  return new PointsBazaarProvider();
}

export function createAwardProvider(): FlightProvider {
  const mode = process.env.DATA_MODE || "mock";

  if (mode === "mock") {
    return new MockFlightProvider();
  }

  return new ChinaAirlinesAwardProvider();
}
