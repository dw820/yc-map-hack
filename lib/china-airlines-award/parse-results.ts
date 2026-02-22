import { writeFileSync } from "fs";
import { resolve } from "path";
import type { Page } from "playwright-core";
import { AWARD_API_RESPONSE_PATTERNS } from "./config.js";
import type { AwardFlightOption } from "./types.js";

const DEBUG_DIR = resolve(import.meta.dirname);

/** Intercepted API responses collected during the search */
export interface NetworkInterceptor {
  responses: Array<{ url: string; data: unknown }>;
  start: () => void;
}

/** Set up network interception to capture award search API calls */
export function createNetworkInterceptor(page: Page): NetworkInterceptor {
  const responses: Array<{ url: string; data: unknown }> = [];

  const start = () => {
    page.on("response", async (response) => {
      const url = response.url();

      try {
        const contentType = response.headers()["content-type"] || "";
        if (!contentType.includes("json")) return;

        const isApiCall = AWARD_API_RESPONSE_PATTERNS.some((pattern) => {
          const regex = new RegExp(
            pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")
          );
          return regex.test(url);
        });

        if (!isApiCall) return;

        const data = await response.json();
        console.log(`[parse-results] Intercepted API response: ${url.slice(0, 120)}`);
        responses.push({ url, data });
      } catch {
        // Not JSON or failed to parse — skip
      }
    });
  };

  return { responses, start };
}

/** Save intercepted API responses to debug files for inspection */
export function saveDebugResponses(
  responses: Array<{ url: string; data: unknown }>
): void {
  if (responses.length === 0) return;

  const debugPath = resolve(DEBUG_DIR, "debug-api-responses.json");
  try {
    writeFileSync(
      debugPath,
      JSON.stringify(
        responses.map((r) => ({ url: r.url, data: r.data })),
        null,
        2
      )
    );
    console.log(`[parse-results] Saved ${responses.length} API responses to ${debugPath}`);
  } catch (e) {
    console.warn(`[parse-results] Failed to save API responses: ${e}`);
  }
}

/**
 * Try to extract award flight options from intercepted API responses.
 * Returns null if no usable data found — caller should fall back to DOM parsing.
 */
export function parseInterceptedAwardData(
  responses: Array<{ url: string; data: unknown }>
): AwardFlightOption[] | null {
  if (responses.length === 0) return null;

  for (const { url, data } of responses) {
    try {
      const flights = extractAwardFlightsFromJson(data);
      if (flights && flights.length > 0) {
        console.log(
          `[parse-results] Extracted ${flights.length} award flights from API: ${url.slice(0, 100)}`
        );
        return flights;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Recursively search a JSON structure for award flight data.
 * Award APIs typically return arrays of flight options with miles pricing.
 */
function extractAwardFlightsFromJson(data: unknown): AwardFlightOption[] | null {
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;

  // Look for arrays that might contain award flight data
  const arrayKeys = [
    "flights",
    "flightOptions",
    "itineraries",
    "results",
    "outbound",
    "recommendations",
    "offers",
    "journeys",
    "availabilities",
    "awardFlights",
    "awardOptions",
    "mileageFlights",
    "seatResults",
  ];

  for (const key of arrayKeys) {
    if (Array.isArray(obj[key]) && obj[key].length > 0) {
      const mapped = (obj[key] as unknown[])
        .map((item) => mapToAwardFlightOption(item))
        .filter((f): f is AwardFlightOption => f !== null);
      if (mapped.length > 0) return mapped;
    }
  }

  // Search one level deeper
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const result = extractAwardFlightsFromJson(value);
      if (result) return result;
    }
  }

  return null;
}

/** Map an unknown award flight object to our AwardFlightOption schema */
function mapToAwardFlightOption(raw: unknown): AwardFlightOption | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;

  try {
    // Extract segments
    const rawSegments =
      (item.segments as unknown[]) ||
      (item.legs as unknown[]) ||
      (item.flights as unknown[]) ||
      [item];

    const segments = (Array.isArray(rawSegments) ? rawSegments : [rawSegments])
      .map((seg) => {
        const s = seg as Record<string, unknown>;
        return {
          flightNumber:
            String(s.flightNumber || s.flight_number || s.flightNo || s.number || ""),
          airline: String(s.airline || s.carrier || s.airlineName || "China Airlines"),
          departureAirport: String(
            s.departureAirport || s.origin || s.departure?.toString() || ""
          ),
          arrivalAirport: String(
            s.arrivalAirport || s.destination || s.arrival?.toString() || ""
          ),
          departureTime: String(
            s.departureTime || s.departure_time || s.depTime || ""
          ),
          arrivalTime: String(
            s.arrivalTime || s.arrival_time || s.arrTime || ""
          ),
          duration: s.duration ? String(s.duration) : undefined,
          aircraft: s.aircraft ? String(s.aircraft) : undefined,
        };
      })
      .filter((s) => s.flightNumber || s.departureTime);

    // Extract miles price
    const milesPrice =
      typeof item.miles === "number"
        ? item.miles
        : typeof item.milesPrice === "number"
          ? item.milesPrice
          : typeof item.mileage === "number"
            ? item.mileage
            : typeof item.points === "number"
              ? item.points
              : undefined;

    // Extract taxes/fees
    const rawTaxes = (item.taxes as Record<string, unknown>) ||
      (item.taxesAndFees as Record<string, unknown>) ||
      (item.fee as Record<string, unknown>) ||
      {};
    const taxAmount =
      typeof rawTaxes.amount === "number"
        ? rawTaxes.amount
        : typeof item.tax === "number"
          ? item.tax
          : typeof item.fees === "number"
            ? item.fees
            : undefined;

    // Extract seat availability
    const seatAvailability =
      typeof item.seats === "number"
        ? item.seats
        : typeof item.availability === "number"
          ? item.availability
          : typeof item.quota === "number"
            ? item.quota
            : undefined;

    return {
      segments,
      totalDuration: item.totalDuration
        ? String(item.totalDuration)
        : item.duration
          ? String(item.duration)
          : undefined,
      stops:
        typeof item.stops === "number"
          ? item.stops
          : segments.length > 0
            ? segments.length - 1
            : 0,
      milesPrice,
      taxesAndFees: {
        amount: taxAmount,
        currency: String(rawTaxes.currency || "USD"),
        displayText: taxAmount != null
          ? `USD ${taxAmount}`
          : String(rawTaxes.displayText || "N/A"),
      },
      seatAvailability,
      bookingClass: item.bookingClass
        ? String(item.bookingClass)
        : item.fareClass
          ? String(item.fareClass)
          : undefined,
      fareFamily: item.fareFamily
        ? String(item.fareFamily)
        : item.fareFamilyCode
          ? String(item.fareFamilyCode)
          : undefined,
      cabinClass: String(
        item.cabinClass || item.cabin || item.fareClass || "Economy"
      ),
    };
  } catch {
    return null;
  }
}

/** Fallback: scrape award flight data from the DOM */
export async function parseDomAwardResults(page: Page): Promise<AwardFlightOption[]> {
  console.log("[parse-results] Attempting DOM-based award parsing...");

  const bodyText = await page.locator("body").textContent().catch(() => "");
  if (!bodyText) {
    console.log("[parse-results] No body text found");
    return [];
  }

  const flights: AwardFlightOption[] = [];

  // Extract miles amounts: "25,000 miles", "25000 Miles", "MILES 80,000", etc.
  const milesPattern = /(?:(?:miles?|哩程)\s*([\d,]+)|([\d,]+)\s*(?:miles?|哩程))/gi;
  const milesMatchesRaw = [...bodyText.matchAll(milesPattern)];
  // Normalize: pick whichever capture group matched
  const milesMatches = milesMatchesRaw.map((m) => {
    const digits = m[1] || m[2];
    return [m[0], digits] as [string, string];
  });

  // Extract tax amounts: "USD 50.00", "$50", "US$50.00"
  const taxPattern = /(?:USD|US\$|\$)\s*([\d,]+(?:\.\d{2})?)/g;
  const taxMatches = [...bodyText.matchAll(taxPattern)];

  // Extract seat availability: "3 seats", "2 seat"
  const seatPattern = /(\d+)\s*seat/gi;
  const seatMatches = [...bodyText.matchAll(seatPattern)];

  // Extract flight numbers: CI + digits
  const flightNumPattern = /CI\s*\d{3,4}/g;
  const flightNumMatches = [...bodyText.matchAll(flightNumPattern)];

  // Extract times: HH:MM
  const timePattern = /\d{1,2}:\d{2}/g;
  const timeMatches = [...bodyText.matchAll(timePattern)];

  // Build flight options from extracted data
  // Use miles matches as the primary anchor (each unique miles amount = one option)
  const seenMiles = new Set<string>();

  for (let i = 0; i < milesMatches.length; i++) {
    const milesStr = milesMatches[i][1].replace(/,/g, "");
    const milesKey = milesStr;
    if (seenMiles.has(milesKey)) continue;
    seenMiles.add(milesKey);

    const milesPrice = parseInt(milesStr, 10);
    if (isNaN(milesPrice) || milesPrice < 1000) continue; // Skip tiny numbers

    const taxAmount = taxMatches[i]
      ? parseFloat(taxMatches[i][1].replace(/,/g, ""))
      : undefined;

    const seatAvailability = seatMatches[i]
      ? parseInt(seatMatches[i][1], 10)
      : undefined;

    const flightNumber = flightNumMatches[i]
      ? flightNumMatches[i][0].replace(/\s/g, "")
      : "Unknown";

    const depTime = timeMatches[i * 2] ? timeMatches[i * 2][0] : "";
    const arrTime = timeMatches[i * 2 + 1] ? timeMatches[i * 2 + 1][0] : "";

    flights.push({
      segments: [
        {
          flightNumber,
          airline: "China Airlines",
          departureAirport: "",
          arrivalAirport: "",
          departureTime: depTime,
          arrivalTime: arrTime,
        },
      ],
      stops: 0,
      milesPrice,
      taxesAndFees: {
        amount: taxAmount,
        currency: "USD",
        displayText: taxAmount != null ? `USD ${taxAmount}` : "N/A",
      },
      seatAvailability,
      cabinClass: "Economy",
    });
  }

  console.log(`[parse-results] Extracted ${flights.length} award flights from DOM`);

  if (flights.length === 0) {
    console.log(
      `[parse-results] Page body (first 500 chars): ${bodyText.slice(0, 500)}`
    );
  }

  return flights;
}

/** Main parse function: tries intercepted API data first, falls back to DOM */
export async function parseAwardResults(
  page: Page,
  interceptedResponses: Array<{ url: string; data: unknown }>
): Promise<AwardFlightOption[]> {
  // Try API interception first
  const apiFlights = parseInterceptedAwardData(interceptedResponses);
  if (apiFlights && apiFlights.length > 0) {
    return apiFlights;
  }

  // Fallback to DOM scraping
  return parseDomAwardResults(page);
}
