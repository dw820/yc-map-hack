/**
 * Test script for Dynasty Flyer login flow.
 * Run with: npx tsx lib/china-airlines-award/test-login.ts
 *
 * This opens a Browserbase browser session, navigates to the Dynasty Flyer
 * login page, and prints a debug URL. Complete the login manually via the
 * debug URL (email verification). The script polls for up to 5 minutes.
 *
 * On success, saves DYNASTY_FLYER_CONTEXT_ID to .env for future searches.
 *
 * Required env vars:
 *   BROWSERBASE_API_KEY
 *   BROWSERBASE_PROJECT_ID
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

import { loginDynastyFlyer } from "./index.js";

/** Write the context ID back to .env so future runs reuse it */
function saveContextId(contextId: string) {
  try {
    let envContent = readFileSync(envPath, "utf-8");
    if (envContent.includes(`DYNASTY_FLYER_CONTEXT_ID=${contextId}`)) return;

    if (envContent.includes("DYNASTY_FLYER_CONTEXT_ID=")) {
      envContent = envContent.replace(
        /DYNASTY_FLYER_CONTEXT_ID=.*/,
        `DYNASTY_FLYER_CONTEXT_ID=${contextId}`
      );
    } else {
      envContent += `\nDYNASTY_FLYER_CONTEXT_ID=${contextId}\n`;
    }
    writeFileSync(envPath, envContent);
    console.log(`\n[test] Saved DYNASTY_FLYER_CONTEXT_ID=${contextId} to .env`);
  } catch (e) {
    console.warn(`[test] Could not save context ID to .env: ${e}`);
  }
}

/** Write the session ID back to .env so search can reconnect */
function saveSessionId(sessionId: string) {
  try {
    let envContent = readFileSync(envPath, "utf-8");
    if (envContent.includes(`DYNASTY_FLYER_SESSION_ID=${sessionId}`)) return;

    if (envContent.includes("DYNASTY_FLYER_SESSION_ID=")) {
      envContent = envContent.replace(
        /DYNASTY_FLYER_SESSION_ID=.*/,
        `DYNASTY_FLYER_SESSION_ID=${sessionId}`
      );
    } else {
      envContent += `\nDYNASTY_FLYER_SESSION_ID=${sessionId}\n`;
    }
    writeFileSync(envPath, envContent);
    console.log(`\n[test] Saved DYNASTY_FLYER_SESSION_ID=${sessionId} to .env`);
  } catch (e) {
    console.warn(`[test] Could not save session ID to .env: ${e}`);
  }
}

async function main() {
  console.log("=== Dynasty Flyer Login Test ===");
  console.log("This will open a browser session for you to log in.");
  console.log("You have 5 minutes to complete the login.\n");

  // Verify env vars
  for (const key of ["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"]) {
    if (!process.env[key]) {
      console.error(`Missing required env var: ${key}`);
      process.exit(1);
    }
  }

  try {
    const result = await loginDynastyFlyer();

    console.log("\n=== Login Result ===");
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);
    if (result.debugUrl) console.log(`Debug URL: ${result.debugUrl}`);
    if (result.sessionId) console.log(`Session ID: ${result.sessionId}`);
    if (result.contextId) console.log(`Context ID: ${result.contextId}`);

    if (result.success && result.contextId) {
      saveContextId(result.contextId);
    }
    if (result.success && result.sessionId) {
      saveSessionId(result.sessionId);
    }

    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error("\n=== Login Failed ===");
    if (err instanceof Error) {
      console.error(`Error: ${err.message}`);
      if ("code" in err) console.error(`Code: ${(err as { code: string }).code}`);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

main();
