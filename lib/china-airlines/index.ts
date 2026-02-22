import { FlightSearchInputSchema, type FlightSearchInput, type FlightSearchResult } from "./types.js";
import { BrowserSessionManager } from "./browser-session.js";
import { fillAndSubmitSearchForm } from "./search-form.js";
import { createNetworkInterceptor, parseFlightResults, saveDebugResponses } from "./parse-results.js";
import { SearchError } from "./errors.js";

export { SearchError } from "./errors.js";
export type { FlightSearchInput, FlightSearchResult, FlightOption } from "./types.js";

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 3_000;

/** Non-retryable error codes */
const PERMANENT_ERRORS = new Set(["INVALID_INPUT", "CAPTCHA_DETECTED"]);

export async function searchFlights(
  rawInput: FlightSearchInput
): Promise<FlightSearchResult> {
  // Validate input
  const parseResult = FlightSearchInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    throw new SearchError(
      "INVALID_INPUT",
      `Invalid search input: ${parseResult.error.message}`
    );
  }
  const input = parseResult.data;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.log(
        `[search] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }

    const manager = BrowserSessionManager.getInstance();
    let session;

    try {
      session = await manager.createSession();
      const { page } = session;

      // Set up network interception before navigating
      const interceptor = createNetworkInterceptor(page);
      interceptor.start();

      // Fill and submit search form
      await fillAndSubmitSearchForm(page, input);

      // Save all intercepted responses for debugging
      saveDebugResponses(interceptor.responses);

      // Parse results
      const outbound = await parseFlightResults(page, interceptor.responses, input.cabinClass);

      // Enrich segment airports from input if missing
      for (const flight of outbound) {
        if (flight.segments.length > 0) {
          const first = flight.segments[0];
          const last = flight.segments[flight.segments.length - 1];
          if (!first.departureAirport) first.departureAirport = input.origin;
          if (!last.arrivalAirport) last.arrivalAirport = input.destination;
        }
      }

      const result: FlightSearchResult = {
        outbound,
        searchInput: input,
        timestamp: new Date().toISOString(),
        resultCount: outbound.length,
      };

      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[search] Attempt ${attempt + 1} failed: ${lastError.message}`
      );

      // Don't retry permanent errors
      if (err instanceof SearchError && PERMANENT_ERRORS.has(err.code)) {
        throw err;
      }
    } finally {
      if (session) {
        await session.close().catch((e: unknown) =>
          console.error("[search] Error closing session:", e)
        );
      }
    }
  }

  throw lastError || new SearchError("TIMEOUT", "Search failed after all retries");
}
