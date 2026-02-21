/**
 * Debug script: navigates to China Airlines, fills form partially,
 * captures state at each step for selector debugging.
 *
 * Run: npx tsx lib/china-airlines/debug-page.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

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
    if (value && !process.env[key]) process.env[key] = value;
  }
} catch {}

import { BrowserSessionManager } from "./browser-session.js";

async function main() {
  const manager = BrowserSessionManager.getInstance();
  const session = await manager.createSession();
  const { page } = session;

  try {
    console.log("Navigating to China Airlines...");
    await page.goto("https://www.china-airlines.com/us/en", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await new Promise((r) => setTimeout(r, 5000));

    // Dismiss popup
    try {
      const popup = page.locator('button:has-text("Accept"), button:has-text("Got it"), button:has-text("OK")').first();
      if (await popup.isVisible({ timeout: 3000 })) await popup.click();
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));

    // Select One Way
    console.log("\n=== Selecting One Way ===");
    await page.locator('#fr-dropdownButton').click();
    await new Promise((r) => setTimeout(r, 500));
    await page.locator('li[data-value="one-way"]').click();
    await new Promise((r) => setTimeout(r, 2000));

    // Fill origin
    console.log("\n=== Filling origin: TPE ===");
    const originInput = page.locator('#From-booking');
    await originInput.click();
    await new Promise((r) => setTimeout(r, 500));
    await originInput.fill("");
    await originInput.pressSequentially("TPE", { delay: 120 });
    await new Promise((r) => setTimeout(r, 2000));
    // Try to select from list
    try {
      const suggestion = page.locator('li:has-text("TPE")').first();
      if (await suggestion.isVisible({ timeout: 2000 })) {
        await suggestion.click();
        console.log("Selected TPE from suggestions");
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));

    // Fill destination
    console.log("\n=== Filling destination: NRT ===");
    const destInput = page.locator('#To-booking');
    await destInput.click();
    await new Promise((r) => setTimeout(r, 500));
    await destInput.fill("");
    await destInput.pressSequentially("NRT", { delay: 120 });
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const suggestion = page.locator('li:has-text("NRT")').first();
      if (await suggestion.isVisible({ timeout: 2000 })) {
        await suggestion.click();
        console.log("Selected NRT from suggestions");
      } else {
        await destInput.press("Enter");
        console.log("Pressed Enter for NRT");
      }
    } catch {
      await destInput.press("Enter");
    }
    await new Promise((r) => setTimeout(r, 2000));

    // Take screenshot of current state
    const ssPath = resolve(import.meta.dirname, "debug-after-airports.png");
    await page.screenshot({ path: ssPath, fullPage: false });
    console.log(`Screenshot after airports: ${ssPath}`);

    // Now look for date-related elements that are visible
    console.log("\n=== Visible date-related elements ===");
    const dateElements = await page.locator('[class*="date"], [class*="Date"], [id*="date"], [id*="Date"], [class*="cal-"], .result-oneway, #departureDateMobile, .cal-extend-date').all();
    for (const el of dateElements) {
      const visible = await el.isVisible().catch(() => false);
      if (!visible) continue;
      const tag = await el.evaluate(e => e.tagName);
      const cls = await el.getAttribute("class") || "";
      const id = await el.getAttribute("id") || "";
      const text = (await el.textContent() || "").trim().slice(0, 80);
      console.log(`  [VISIBLE] <${tag}> id="${id}" class="${cls.slice(0, 100)}" text="${text}"`);
    }

    // Check the departure date input specifically
    console.log("\n=== departureDateMobile input state ===");
    const dateInput = page.locator('#departureDateMobile');
    const dateVisible = await dateInput.isVisible().catch(() => false);
    const dateValue = await dateInput.inputValue().catch(() => "N/A");
    console.log(`  visible=${dateVisible} value="${dateValue}"`);

    // Check what's around the date area
    console.log("\n=== cal-extend-date state ===");
    const calExtend = page.locator('.cal-extend-date');
    const calVisible = await calExtend.isVisible().catch(() => false);
    const calClass = await calExtend.getAttribute("class").catch(() => "N/A");
    console.log(`  visible=${calVisible} class="${calClass}"`);

    // Try clicking the date area container
    console.log("\n=== Trying to find clickable date area ===");
    const possibleDateTriggers = [
      '#departureDateMobile',
      '.cal-extend-date',
      '.cal-date-select-mb',
      '.cal-flight-date',
      'p[ng-click*="showInputDeparture"]',
      '.cal-date-select',
      'span.result',
    ];
    for (const sel of possibleDateTriggers) {
      const el = page.locator(sel).first();
      const vis = await el.isVisible().catch(() => false);
      const txt = vis ? (await el.textContent().catch(() => "")).trim().slice(0, 60) : "";
      console.log(`  ${sel}: visible=${vis} text="${txt}"`);
    }

    console.log(`\nReplay: https://browserbase.com/sessions/${session.sessionId}`);
  } finally {
    await session.close();
  }
}

main().catch(console.error);
