import { writeFileSync } from "fs";
import { resolve } from "path";
import type { Page } from "playwright-core";
import { API_RESPONSE_PATTERNS, SELECTORS } from "./config.js";
import type { FlightOption } from "./types.js";

const DEBUG_DIR = resolve(import.meta.dirname);

/** Intercepted API responses collected during the search */
export interface NetworkInterceptor {
  responses: Array<{ url: string; data: unknown }>;
  start: () => void;
}

/** Set up network interception to capture flight search API calls */
export function createNetworkInterceptor(page: Page): NetworkInterceptor {
  const responses: Array<{ url: string; data: unknown }> = [];

  const start = () => {
    page.on("response", async (response) => {
      const url = response.url();

      try {
        const contentType = response.headers()["content-type"] || "";
        if (!contentType.includes("json")) return;

        // Always capture the air-bounds API (primary flight data source)
        const isAirBounds = url.includes("/v2/search/air-bounds");

        const isApiCall = isAirBounds || API_RESPONSE_PATTERNS.some((pattern) => {
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
  // Save full air-bounds response for debugging
  const airBoundsResp = responses.find(r => r.url.includes("/air-bounds"));
  if (airBoundsResp) {
    const airBoundsPath = resolve(DEBUG_DIR, "debug-air-bounds-full.json");
    try {
      writeFileSync(airBoundsPath, JSON.stringify(airBoundsResp.data, null, 2));
      console.log(`[parse-results] Saved air-bounds response to ${airBoundsPath}`);
    } catch (e) {
      console.warn(`[parse-results] Failed to save air-bounds response: ${e}`);
    }
  }
}

/**
 * Try to extract flight options from intercepted API responses.
 * Returns null if no usable data found — caller should fall back to DOM parsing.
 */
export function parseInterceptedData(
  responses: Array<{ url: string; data: unknown }>
): FlightOption[] | null {
  if (responses.length === 0) return null;

  // Priority 1: Look for the China Airlines air-bounds API response
  const airBoundsResp = responses.find((r) =>
    r.url.includes("/v2/search/air-bounds")
  );
  if (airBoundsResp) {
    try {
      const flights = parseChinaAirlinesAirBounds(airBoundsResp.data);
      if (flights && flights.length > 0) {
        console.log(
          `[parse-results] Extracted ${flights.length} flights from air-bounds API`
        );
        return flights;
      }
    } catch (e) {
      console.warn(`[parse-results] Failed to parse air-bounds: ${e}`);
    }
  }

  // Fallback: try generic extraction on all responses
  for (const { url, data } of responses) {
    try {
      const flights = extractFlightsFromJson(data);
      if (flights && flights.length > 0) {
        console.log(
          `[parse-results] Extracted ${flights.length} flights from API: ${url}`
        );
        return flights;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ── China Airlines air-bounds API parser ────────────────────────────

interface AirBoundsResponse {
  data?: {
    airBoundGroups?: AirBoundGroup[];
  };
  dictionaries?: {
    flight?: Record<string, FlightDictEntry>;
    airline?: Record<string, string>;
    aircraft?: Record<string, string>;
  };
}

interface AirBoundGroup {
  boundDetails?: {
    originLocationCode?: string;
    destinationLocationCode?: string;
    duration?: number; // seconds
    segments?: Array<{ flightId?: string }>;
  };
  airBounds?: AirBound[];
}

interface AirBound {
  isCheapestOffer?: boolean;
  fareFamilyCode?: string;
  availabilityDetails?: Array<{
    flightId?: string;
    cabin?: string;
    bookingClass?: string;
    quota?: number;
  }>;
  prices?: {
    totalPrices?: Array<{
      total?: number;
      base?: number;
      currencyCode?: string;
      totalTaxes?: number;
    }>;
  };
  fareInfos?: Array<{
    fareType?: string;
    fareClass?: string;
  }>;
}

interface FlightDictEntry {
  marketingAirlineCode?: string;
  operatingAirlineCode?: string;
  marketingFlightNumber?: string;
  departure?: { locationCode?: string; dateTime?: string; terminal?: string };
  arrival?: { locationCode?: string; dateTime?: string; terminal?: string };
  aircraftCode?: string;
  duration?: number;
}

/** Parse the China Airlines /v2/search/air-bounds API response */
function parseChinaAirlinesAirBounds(raw: unknown): FlightOption[] | null {
  const resp = raw as AirBoundsResponse;
  const groups = resp?.data?.airBoundGroups;
  if (!Array.isArray(groups) || groups.length === 0) return null;

  const flightDict = resp?.dictionaries?.flight ?? {};
  const airlineDict = resp?.dictionaries?.airline ?? {};
  const aircraftDict = resp?.dictionaries?.aircraft ?? {};
  const flights: FlightOption[] = [];

  for (const group of groups) {
    const bd = group.boundDetails;
    if (!bd?.segments?.length) continue;

    // Find the cheapest economy fare (or just the cheapest overall)
    const cheapest =
      group.airBounds?.find((ab) => ab.isCheapestOffer) ??
      group.airBounds?.[0];

    // Build segments from dictionaries
    const segments = bd.segments
      .map((seg) => {
        const flightId = seg.flightId ?? "";
        const dict = flightDict[flightId];
        if (!dict) return null;

        const airlineCode = dict.marketingAirlineCode ?? "CI";
        const flightNumber = `${airlineCode}${dict.marketingFlightNumber ?? ""}`;
        const airlineName = airlineDict[airlineCode] ?? "China Airlines";

        const depTime = dict.departure?.dateTime
          ? formatTime(dict.departure.dateTime)
          : "";
        const arrTime = dict.arrival?.dateTime
          ? formatTime(dict.arrival.dateTime)
          : "";

        const durationSecs = dict.duration ?? bd.duration ?? 0;
        const durationStr = formatDuration(durationSecs);

        return {
          flightNumber,
          airline: airlineName,
          departureAirport: dict.departure?.locationCode ?? bd.originLocationCode ?? "",
          arrivalAirport: dict.arrival?.locationCode ?? bd.destinationLocationCode ?? "",
          departureTime: depTime,
          arrivalTime: arrTime,
          duration: durationStr || undefined,
          aircraft: dict.aircraftCode
            ? aircraftDict[dict.aircraftCode] ?? dict.aircraftCode
            : undefined,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    if (segments.length === 0) continue;

    // Price from cheapest fare
    const priceData = cheapest?.prices?.totalPrices?.[0];
    const amount = priceData?.total;
    const currency = priceData?.currencyCode ?? "TWD";

    // Cabin from availability details
    const cabinRaw = cheapest?.availabilityDetails?.[0]?.cabin ?? "eco";
    const cabinClass = cabinRaw === "eco" ? "Economy"
      : cabinRaw === "business" ? "Business"
      : cabinRaw === "premium_eco" ? "Premium Economy"
      : cabinRaw;

    // Total duration
    const totalDurationSecs = bd.duration ?? 0;
    const totalDuration = formatDuration(totalDurationSecs);

    flights.push({
      segments,
      totalDuration: totalDuration || undefined,
      stops: segments.length - 1,
      price: {
        amount,
        currency,
        displayText: amount != null
          ? `${currency} ${amount.toLocaleString()}`
          : "N/A",
      },
      cabinClass,
      fareType: cheapest?.fareInfos?.[0]?.fareClass,
    });
  }

  return flights.length > 0 ? flights : null;
}

/** Extract HH:MM from an ISO datetime string */
function formatTime(isoDateTime: string): string {
  const match = isoDateTime.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

/** Convert seconds to "Xh Ym" format */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Recursively search a JSON structure for flight-like data.
 * Airline APIs vary widely — this handles common patterns.
 */
function extractFlightsFromJson(data: unknown): FlightOption[] | null {
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;

  // Look for arrays that might contain flight data
  const arrayKeys = [
    "flights",
    "flightOptions",
    "itineraries",
    "results",
    "outbound",
    "recommendations",
    "offers",
    "journeys",
    "boundList",
    "availabilities",
  ];

  for (const key of arrayKeys) {
    if (Array.isArray(obj[key]) && obj[key].length > 0) {
      return (obj[key] as unknown[]).map((item) => mapToFlightOption(item)).filter(Boolean) as FlightOption[];
    }
  }

  // Search one level deeper
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const result = extractFlightsFromJson(value);
      if (result) return result;
    }
  }

  return null;
}

/** Map an unknown flight object to our FlightOption schema */
function mapToFlightOption(raw: unknown): FlightOption | null {
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

    // Extract price
    const rawPrice =
      (item.price as Record<string, unknown>) ||
      (item.fare as Record<string, unknown>) ||
      (item.pricing as Record<string, unknown>) ||
      {};
    const amount =
      typeof rawPrice.amount === "number"
        ? rawPrice.amount
        : typeof rawPrice.total === "number"
          ? rawPrice.total
          : typeof item.price === "number"
            ? item.price
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
      price: {
        amount,
        currency: String(rawPrice.currency || "USD"),
        displayText: amount
          ? `${rawPrice.currency || "USD"} ${amount}`
          : String(rawPrice.displayText || rawPrice.formatted || item.priceDisplay || "N/A"),
      },
      cabinClass: String(
        item.cabinClass || item.cabin || item.fareClass || "Economy"
      ),
      fareType: item.fareType ? String(item.fareType) : undefined,
    };
  } catch {
    return null;
  }
}

/** Fallback: scrape flight data from the DOM */
export async function parseDomResults(page: Page): Promise<FlightOption[]> {
  console.log("[parse-results] Attempting DOM-based parsing...");

  const cardSelector = SELECTORS.flightCard.join(", ");
  const cards = await page.locator(cardSelector).all().catch(() => []);

  if (cards.length === 0) {
    console.log("[parse-results] No flight cards found in DOM");
    // Last resort: grab whatever text is on the page for debugging
    const bodyText = await page.locator("body").textContent().catch(() => "");
    if (bodyText) {
      console.log(
        `[parse-results] Page body (first 500 chars): ${bodyText.slice(0, 500)}`
      );
    }
    return [];
  }

  console.log(`[parse-results] Found ${cards.length} flight cards in DOM`);
  const flights: FlightOption[] = [];

  for (const card of cards) {
    try {
      const text = (await card.textContent()) || "";

      // Extract flight number (CI + digits pattern)
      const flightNumMatch = text.match(/CI\s*\d{3,4}/);
      // Extract times (HH:MM pattern)
      const timeMatches = text.match(/\d{1,2}:\d{2}/g) || [];
      // Extract price (currency + digits pattern)
      const priceMatch = text.match(
        /(?:USD|US\$|\$|TWD|NT\$)\s*[\d,]+(?:\.\d{2})?/
      );
      // Extract duration
      const durationMatch = text.match(/(\d+)\s*h\s*(\d+)?\s*m?/i);
      // Extract stops
      const stopsMatch = text.match(/(\d+)\s*stop/i);
      const nonStop = /non-?stop|direct/i.test(text);

      flights.push({
        segments: [
          {
            flightNumber: flightNumMatch ? flightNumMatch[0].replace(/\s/g, "") : "Unknown",
            airline: "China Airlines",
            departureAirport: "",
            arrivalAirport: "",
            departureTime: timeMatches[0] || "",
            arrivalTime: timeMatches[1] || "",
            duration: durationMatch
              ? `${durationMatch[1]}h${durationMatch[2] ? ` ${durationMatch[2]}m` : ""}`
              : undefined,
          },
        ],
        totalDuration: durationMatch
          ? `${durationMatch[1]}h${durationMatch[2] ? ` ${durationMatch[2]}m` : ""}`
          : undefined,
        stops: nonStop ? 0 : stopsMatch ? parseInt(stopsMatch[1], 10) : 0,
        price: {
          amount: priceMatch
            ? parseFloat(priceMatch[0].replace(/[^0-9.]/g, ""))
            : undefined,
          currency: "USD",
          displayText: priceMatch ? priceMatch[0] : "N/A",
        },
        cabinClass: "Economy",
      });
    } catch {
      continue;
    }
  }

  return flights;
}

/** Main parse function: tries intercepted API data first, falls back to DOM */
export async function parseFlightResults(
  page: Page,
  interceptedResponses: Array<{ url: string; data: unknown }>
): Promise<FlightOption[]> {
  // Try API interception first
  const apiFlights = parseInterceptedData(interceptedResponses);
  if (apiFlights && apiFlights.length > 0) {
    return apiFlights;
  }

  // Fallback to DOM scraping
  return parseDomResults(page);
}
