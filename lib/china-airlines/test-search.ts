/**
 * Standalone test script for China Airlines flight search.
 * Run with: npx tsx lib/china-airlines/test-search.ts
 *
 * Required env vars:
 *   BROWSERBASE_API_KEY
 *   BROWSERBASE_PROJECT_ID
 *   CHINA_AIRLINES_CONTEXT_ID (optional, auto-created if missing)
 */

import { readFileSync, writeFileSync } from "fs";
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

import { searchFlights } from "./index.js";
import { BrowserSessionManager } from "./browser-session.js";

const TEST_INPUT = {
  origin: "TPE",
  destination: "NRT",
  departureDate: "2026-04-15",
  cabinClass: "economy" as const,
  adults: 1,
};

/** Write the auto-created context ID back to .env so future runs reuse it */
async function saveContextId() {
  const manager = BrowserSessionManager.getInstance();
  const contextId = manager.lastCreatedContextId;
  if (!contextId) return;

  try {
    let envContent = readFileSync(envPath, "utf-8");
    if (envContent.includes(`CHINA_AIRLINES_CONTEXT_ID=${contextId}`)) return;

    // Replace empty value or update existing
    if (envContent.includes("CHINA_AIRLINES_CONTEXT_ID=")) {
      envContent = envContent.replace(
        /CHINA_AIRLINES_CONTEXT_ID=.*/,
        `CHINA_AIRLINES_CONTEXT_ID=${contextId}`
      );
    } else {
      envContent += `\nCHINA_AIRLINES_CONTEXT_ID=${contextId}\n`;
    }
    writeFileSync(envPath, envContent);
    console.log(`\n[test] Saved CHINA_AIRLINES_CONTEXT_ID=${contextId} to .env`);
  } catch (e) {
    console.warn(`[test] Could not save context ID to .env: ${e}`);
  }
}

async function main() {
  console.log("=== China Airlines Flight Search Test ===");
  console.log(`Route: ${TEST_INPUT.origin} → ${TEST_INPUT.destination}`);
  console.log(`Date: ${TEST_INPUT.departureDate}`);
  console.log(`Cabin: ${TEST_INPUT.cabinClass}`);
  console.log(`Adults: ${TEST_INPUT.adults}`);
  console.log("=========================================\n");

  // Verify env vars
  for (const key of ["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"]) {
    if (!process.env[key]) {
      console.error(`Missing required env var: ${key}`);
      process.exit(1);
    }
  }

  try {
    const result = await searchFlights(TEST_INPUT);

    console.log(`\n=== Results: ${result.resultCount} flights found ===\n`);

    if (result.outbound.length === 0) {
      console.log("No flights found. Check Browserbase session replay for debugging.");
      console.log("This is expected on the first run — selectors likely need refinement.");
    } else {
      for (const [i, flight] of result.outbound.entries()) {
        console.log(`--- Flight ${i + 1} ---`);
        for (const seg of flight.segments) {
          console.log(
            `  ${seg.flightNumber}: ${seg.departureAirport} ${seg.departureTime} → ${seg.arrivalAirport} ${seg.arrivalTime}`
          );
          if (seg.duration) console.log(`  Duration: ${seg.duration}`);
        }
        console.log(`  Stops: ${flight.stops}`);
        console.log(`  Price: ${flight.price.displayText}`);
        console.log(`  Cabin: ${flight.cabinClass}`);
        if (flight.fareType) console.log(`  Fare: ${flight.fareType}`);
        console.log();
      }
    }

    console.log(`Timestamp: ${result.timestamp}`);

    // Save context ID to .env if it was auto-created
    await saveContextId();
  } catch (err) {
    // Still try to save context ID even on failure
    await saveContextId().catch(() => {});
    console.error("\n=== Search Failed ===");
    if (err instanceof Error) {
      console.error(`Error: ${err.message}`);
      if ("code" in err) console.error(`Code: ${(err as { code: string }).code}`);
      console.error(`Stack: ${err.stack}`);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

main();
