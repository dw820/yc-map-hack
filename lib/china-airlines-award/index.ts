import {
  AwardSearchInputSchema,
  type AwardSearchInput,
  type AwardSearchResult,
  type LoginResult,
} from "./types.js";
import { AwardBrowserSessionManager } from "./browser-session.js";
import { startLoginSession, pollForLoginCompletion } from "./login.js";
import { navigateToAwardPage, fillAndSubmitAwardSearchForm } from "./search-form.js";
import {
  createNetworkInterceptor,
  parseAwardResults,
  saveDebugResponses,
} from "./parse-results.js";
import { AwardSearchError } from "./errors.js";

export { AwardSearchError } from "./errors.js";
export type {
  AwardSearchInput,
  AwardSearchResult,
  AwardFlightOption,
  LoginResult,
} from "./types.js";

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 3_000;

/** Non-retryable error codes — these require user action */
const PERMANENT_ERRORS = new Set([
  "INVALID_INPUT",
  "AUTH_REQUIRED",
  "AUTH_EXPIRED",
]);

/**
 * Start the Dynasty Flyer login flow.
 * Opens a browser session, navigates to the login page, and waits for the user
 * to complete login via email verification.
 *
 * Returns a debug URL for the user to view/interact with the browser,
 * and the context ID to persist for future sessions.
 */
export async function loginDynastyFlyer(): Promise<LoginResult> {
  let session;

  try {
    const result = await startLoginSession();
    session = result.session;
    const contextId = result.contextId;

    console.log("[award] Login session started.");
    console.log(`[award] Debug URL: ${session.debugUrl}`);
    console.log("[award] Waiting for user to complete login...");

    // Poll for login completion (blocks up to 5 minutes)
    // Polling confirms login succeeded by detecting redirect to china-airlines.com
    await pollForLoginCompletion(session.page);

    return {
      success: true,
      debugUrl: session.debugUrl,
      sessionId: session.sessionId,
      contextId,
      message:
        `Login successful! ` +
        `Set DYNASTY_FLYER_CONTEXT_ID=${contextId} in your .env to persist this session.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    return {
      success: false,
      debugUrl: session?.debugUrl,
      sessionId: session?.sessionId,
      message: `Login failed: ${message}`,
    };
  } finally {
    if (session) {
      await session
        .close()
        .catch((e: unknown) =>
          console.error("[award] Error closing login session:", e)
        );
    }
  }
}

/**
 * Search for award flights using Dynasty Flyer miles.
 * Requires a prior login (persisted browser context with auth cookies).
 */
export async function searchAwardFlights(
  rawInput: AwardSearchInput
): Promise<AwardSearchResult> {
  // Validate input
  const parseResult = AwardSearchInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    throw new AwardSearchError(
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
        `[award] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }

    const manager = AwardBrowserSessionManager.getInstance();
    let session;

    try {
      session = await manager.createSession();
      const { page, context } = session;

      // Set up network interception before navigating
      const interceptor = createNetworkInterceptor(page);
      interceptor.start();

      // Navigate to award page (throws AUTH_REQUIRED if session expired)
      const awardPage = await navigateToAwardPage(page, context);

      // If the award page is a different page object, set up interception on it too
      if (awardPage !== page) {
        const awardInterceptor = createNetworkInterceptor(awardPage);
        awardInterceptor.start();

        // Fill and submit search form on the award page
        await fillAndSubmitAwardSearchForm(awardPage, input);

        // Merge intercepted responses
        const allResponses = [
          ...interceptor.responses,
          ...awardInterceptor.responses,
        ];
        saveDebugResponses(allResponses);

        // Parse results
        const outbound = await parseAwardResults(awardPage, allResponses);

        // Enrich segment airports from input if missing
        enrichSegments(outbound, input);

        return buildResult(outbound, input);
      }

      // Fill and submit search form on the same page
      await fillAndSubmitAwardSearchForm(page, input);

      // Save intercepted responses for debugging
      saveDebugResponses(interceptor.responses);

      // Parse results
      const outbound = await parseAwardResults(page, interceptor.responses);

      // Enrich segment airports from input if missing
      enrichSegments(outbound, input);

      return buildResult(outbound, input);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[award] Attempt ${attempt + 1} failed: ${lastError.message}`
      );

      // Don't retry permanent errors
      if (err instanceof AwardSearchError && PERMANENT_ERRORS.has(err.code)) {
        throw err;
      }
    } finally {
      if (session) {
        await session
          .close()
          .catch((e: unknown) =>
            console.error("[award] Error closing session:", e)
          );
      }
    }
  }

  throw (
    lastError ||
    new AwardSearchError("TIMEOUT", "Award search failed after all retries")
  );
}

function enrichSegments(
  outbound: Array<{ segments: Array<{ departureAirport: string; arrivalAirport: string }> }>,
  input: AwardSearchInput
): void {
  for (const flight of outbound) {
    if (flight.segments.length > 0) {
      const first = flight.segments[0];
      const last = flight.segments[flight.segments.length - 1];
      if (!first.departureAirport) first.departureAirport = input.origin;
      if (!last.arrivalAirport) last.arrivalAirport = input.destination;
    }
  }
}

function buildResult(
  outbound: AwardSearchResult["outbound"],
  input: AwardSearchInput
): AwardSearchResult {
  return {
    outbound,
    searchInput: input,
    timestamp: new Date().toISOString(),
    resultCount: outbound.length,
  };
}
