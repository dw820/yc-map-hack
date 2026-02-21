/**
 * Test script for Dynasty Flyer award flight search.
 * Run with: npx tsx lib/china-airlines-award/test-search.ts
 *
 * Requires a prior login — run test-login.ts first and ensure
 * DYNASTY_FLYER_CONTEXT_ID is set in .env.
 *
 * Required env vars:
 *   BROWSERBASE_API_KEY
 *   BROWSERBASE_PROJECT_ID
 *   DYNASTY_FLYER_CONTEXT_ID
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env from project root
const envPath = resolve(import.meta.dirname, "../../.env");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (value && !process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  console.warn("No .env file found, relying on environment variables");
}

import { searchAwardFlights, AwardSearchError } from "./index.js";

const TEST_INPUT = {
  origin: "SFO",
  destination: "TPE",
  departureDate: "2026-04-15",
  cabinClass: "economy" as const,
  adults: 1,
};

async function main() {
  console.log("=== Dynasty Flyer Award Search Test ===");
  console.log(`Route: ${TEST_INPUT.origin} → ${TEST_INPUT.destination}`);
  console.log(`Date: ${TEST_INPUT.departureDate}`);
  console.log(`Cabin: ${TEST_INPUT.cabinClass}`);
  console.log(`Adults: ${TEST_INPUT.adults}`);
  console.log("=======================================\n");

  // Verify env vars
  for (const key of ["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"]) {
    if (!process.env[key]) {
      console.error(`Missing required env var: ${key}`);
      process.exit(1);
    }
  }

  if (!process.env.DYNASTY_FLYER_CONTEXT_ID) {
    console.error(
      "Missing DYNASTY_FLYER_CONTEXT_ID. Run test-login.ts first to authenticate."
    );
    process.exit(1);
  }

  try {
    const result = await searchAwardFlights(TEST_INPUT);

    console.log(`\n=== Results: ${result.resultCount} award flights found ===\n`);

    if (result.outbound.length === 0) {
      console.log("No award flights found. Check Browserbase session replay for debugging.");
      console.log("Debug artifacts saved to lib/china-airlines-award/:");
      console.log("  - debug-award-results.png (screenshot)");
      console.log("  - debug-award-results.html (page HTML)");
      console.log("  - debug-api-responses.json (intercepted APIs)");
    } else {
      for (const [i, flight] of result.outbound.entries()) {
        console.log(`--- Award Flight ${i + 1} ---`);
        for (const seg of flight.segments) {
          console.log(
            `  ${seg.flightNumber}: ${seg.departureAirport} ${seg.departureTime} → ${seg.arrivalAirport} ${seg.arrivalTime}`
          );
          if (seg.duration) console.log(`  Duration: ${seg.duration}`);
          if (seg.aircraft) console.log(`  Aircraft: ${seg.aircraft}`);
        }
        console.log(`  Stops: ${flight.stops}`);
        if (flight.totalDuration) console.log(`  Total Duration: ${flight.totalDuration}`);
        console.log(`  Cabin: ${flight.cabinClass}`);
        if (flight.milesPrice != null) {
          console.log(`  Miles: ${flight.milesPrice.toLocaleString()} miles`);
        }
        console.log(`  Taxes/Fees: ${flight.taxesAndFees.displayText}`);
        if (flight.seatAvailability != null) {
          console.log(`  Seats Available: ${flight.seatAvailability}`);
        }
        if (flight.bookingClass) console.log(`  Booking Class: ${flight.bookingClass}`);
        if (flight.fareFamily) console.log(`  Fare Family: ${flight.fareFamily}`);
        console.log();
      }
    }

    console.log(`Timestamp: ${result.timestamp}`);
  } catch (err) {
    console.error("\n=== Search Failed ===");
    if (err instanceof AwardSearchError) {
      console.error(`Error: ${err.message}`);
      console.error(`Code: ${err.code}`);
      if (err.code === "AUTH_REQUIRED") {
        console.error("\nRun test-login.ts first to authenticate.");
      }
    } else if (err instanceof Error) {
      console.error(`Error: ${err.message}`);
      console.error(`Stack: ${err.stack}`);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

main();
