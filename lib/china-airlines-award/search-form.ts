import { writeFileSync } from "fs";
import { resolve } from "path";
import type { BrowserContext, Page } from "playwright-core";
import {
  AWARD_FORM_SELECTORS,
  AWARD_PAGE_URL_PATTERN,
  DYNASTY_FLYER_DASHBOARD_URL,
  LOGIN_PAGE_URL_PATTERN,
  DELAYS,
  LOGIN_SELECTORS,
  TIMEOUTS,
} from "./config.js";
import { AwardSearchError } from "./errors.js";
import type { AwardSearchInput } from "./types.js";

const DEBUG_DIR = resolve(import.meta.dirname);

/** Human-like delay to avoid bot detection */
async function humanDelay(multiplier = 1): Promise<void> {
  const jitter = Math.random() * DELAYS.jitterMax;
  const ms = (DELAYS.base + jitter) * multiplier;
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Navigate to the award ticket search page via the Dynasty Flyer dashboard.
 * Goes to dynasty-flyer.china-airlines.com/member/dashboard and clicks "Reward Ticket".
 * The award page may open in a new tab, so we handle that via context.waitForEvent("page").
 * Returns the Page to use for form filling (may be different from the input page).
 */
export async function navigateToAwardPage(
  page: Page,
  context: BrowserContext
): Promise<Page> {
  console.log("[search-form] Navigating to Dynasty Flyer dashboard...");

  // Auto-dismiss any JS dialogs (alerts/confirms)
  page.on("dialog", async (dialog) => {
    console.log(`[search-form] Auto-dismissing dialog: ${dialog.type()} "${dialog.message()}"`);
    await dialog.accept().catch(() => {});
  });

  // Go directly to the member dashboard
  await page.goto(DYNASTY_FLYER_DASHBOARD_URL, {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUTS.pageLoad,
  });
  await new Promise((r) => setTimeout(r, 5000));

  console.log(`[search-form] Dashboard loaded: ${page.url()}`);

  // Detect if we got redirected to the login page (session expired)
  if (LOGIN_PAGE_URL_PATTERN.test(page.url())) {
    throw new AwardSearchError(
      "AUTH_REQUIRED",
      "Dynasty Flyer session has expired. Please run the dynasty-flyer-login tool to re-authenticate."
    );
  }

  // Dismiss cookie consent if present
  try {
    const cookieBtn = page
      .locator(
        'button:has-text("Accept"), button:has-text("Got it"), button:has-text("OK"), .cookie-accept'
      )
      .first();
    if (await cookieBtn.isVisible({ timeout: 3000 })) {
      await cookieBtn.click();
      console.log("[search-form] Dismissed cookie/popup banner");
      await humanDelay();
    }
  } catch {
    // No popup
  }

  // Click "Reward Ticket" on the dashboard
  for (const selector of LOGIN_SELECTORS.awardBookingLink) {
    try {
      const link = page.locator(selector).first();
      if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Listen for new page (tab) before clicking
        const newPagePromise = context
          .waitForEvent("page", { timeout: TIMEOUTS.awardPageNavigation })
          .catch(() => null);

        await link.click();
        console.log(`[search-form] Clicked award booking link: ${selector}`);
        await humanDelay();

        // Check if a new tab opened
        const newPage = await newPagePromise;
        if (newPage) {
          // Auto-dismiss any JS dialogs (alerts/confirms) on the award page
          newPage.on("dialog", async (dialog) => {
            console.log(`[search-form] Auto-dismissing dialog: ${dialog.type()} "${dialog.message()}"`);
            await dialog.accept().catch(() => {});
          });

          console.log(`[search-form] Award page opened in new tab: ${newPage.url()}`);
          await newPage.waitForLoadState("domcontentloaded", {
            timeout: TIMEOUTS.pageLoad,
          });
          await new Promise((r) => setTimeout(r, 5000));
          console.log(`[search-form] Award page ready: ${newPage.url()}`);

          // Debug: screenshot the award page so we can see the form
          try {
            const screenshotPath = resolve(DEBUG_DIR, "debug-award-page.png");
            await newPage.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`[search-form] Award page screenshot saved to ${screenshotPath}`);
          } catch (e) {
            console.warn(`[search-form] Failed to save award page screenshot: ${e}`);
          }

          return newPage;
        }

        // Check if current page navigated
        await new Promise((r) => setTimeout(r, 5000));
        console.log(`[search-form] Current page after click: ${page.url()}`);
        return page;
      }
    } catch {
      continue;
    }
  }

  // Fallback: check all pages in context for the award page
  const allPages = context.pages();
  for (const p of allPages) {
    if (AWARD_PAGE_URL_PATTERN.test(p.url())) {
      console.log(`[search-form] Found award page in existing tab: ${p.url()}`);
      return p;
    }
  }

  // Debug: take a screenshot of whatever we're looking at
  try {
    const screenshotPath = resolve(DEBUG_DIR, "debug-dashboard.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[search-form] Dashboard screenshot saved to ${screenshotPath}`);
  } catch (e) {
    console.warn(`[search-form] Failed to save screenshot: ${e}`);
  }

  throw new AwardSearchError(
    "NAVIGATION_FAILED",
    "Could not find 'Reward Ticket' link on the Dynasty Flyer dashboard. The page layout may have changed."
  );
}

/** Fill and submit the award search form */
export async function fillAndSubmitAwardSearchForm(
  page: Page,
  input: AwardSearchInput
): Promise<void> {
  console.log("[search-form] Filling award search form...");

  // Step 1: Check the agreement checkbox
  try {
    const checkbox = page.locator(AWARD_FORM_SELECTORS.agreeCheckbox);
    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isChecked = await checkbox.isChecked().catch(() => false);
      if (!isChecked) {
        await checkbox.check({ force: true });
        console.log("[search-form] Checked agreement checkbox");
        await humanDelay();
      }
    }
  } catch {
    console.warn("[search-form] Could not check agreement checkbox");
  }

  // Step 2: Select one-way trip type
  try {
    const oneWay = page.locator(AWARD_FORM_SELECTORS.oneWayRadio);
    await oneWay.click({ force: true });
    console.log("[search-form] Selected one-way trip type");
    await humanDelay();
  } catch {
    console.warn("[search-form] Could not select one-way trip type");
  }

  // Step 3: Fill origin airport
  await fillStationInput(page, AWARD_FORM_SELECTORS.originInput, input.origin, "origin");

  // Step 4: Fill destination airport
  await fillStationInput(page, AWARD_FORM_SELECTORS.destinationInput, input.destination, "destination");

  // Step 5: Fill departure date (jQuery datepicker — readonly input, set via JS)
  try {
    const [yearStr, monthStr, dayStr] = input.departureDate.split("-");
    // The datepicker expects MM/DD/YYYY format based on the en-AU locale
    const formattedDate = `${monthStr}/${dayStr}/${yearStr}`;
    await page.evaluate(
      ({ selector, date }) => {
        const el = document.querySelector(selector) as HTMLInputElement;
        if (el) {
          el.removeAttribute("readonly");
          el.value = date;
          // Trigger jQuery datepicker change event
          const jq = (window as any).$;
          if (jq) jq(el).datepicker("setDate", date);
        }
      },
      { selector: AWARD_FORM_SELECTORS.departureDateInput, date: formattedDate }
    );
    console.log(`[search-form] Set departure date: ${formattedDate}`);
    await humanDelay();
  } catch (e) {
    console.warn(`[search-form] Could not set departure date: ${e}`);
  }

  // Step 6: Select cabin class
  const cabinSelector = AWARD_FORM_SELECTORS.cabinRadio[input.cabinClass];
  if (cabinSelector) {
    try {
      const cabin = page.locator(cabinSelector);
      await cabin.click({ force: true });
      console.log(`[search-form] Selected cabin class: ${input.cabinClass}`);
      await humanDelay();
    } catch {
      console.warn(`[search-form] Could not select cabin class: ${input.cabinClass}`);
    }
  }

  // Submit the search
  await submitAwardSearch(page);
}

/**
 * Fill a station (airport) autocomplete input.
 * Types the airport code and selects from the suggestion dropdown.
 */
async function fillStationInput(
  page: Page,
  selector: string,
  value: string,
  label: string
): Promise<void> {
  console.log(`[search-form] Filling ${label}: ${value}...`);

  try {
    const input = page.locator(selector);
    await input.click();
    await humanDelay(0.3);
    await input.fill("");
    await humanDelay(0.3);
    await input.pressSequentially(value, { delay: 120 });
    await humanDelay();

    // Wait for autocomplete suggestions and select the first match
    await new Promise((r) => setTimeout(r, 1500));
    try {
      // The autocomplete dropdown uses jQuery UI - look for list items
      const suggestion = page
        .locator(`.ui-autocomplete li:has-text("${value}"), .ui-menu-item:has-text("${value}")`)
        .first();
      if (await suggestion.isVisible({ timeout: 3000 }).catch(() => false)) {
        await suggestion.click();
        console.log(`[search-form] Selected ${value} from autocomplete`);
        await humanDelay();
        return;
      }
    } catch {
      // No autocomplete popup
    }

    // Fallback: press Enter or Tab to confirm
    await input.press("Tab");
    await humanDelay();
    console.log(`[search-form] Filled ${label}: ${value}`);
  } catch (e) {
    console.warn(`[search-form] Could not fill ${label}: ${e}`);
  }
}

/** Click the search button and wait for results */
async function submitAwardSearch(page: Page): Promise<void> {
  console.log("[search-form] Submitting award search...");

  try {
    const btn = page.locator(AWARD_FORM_SELECTORS.searchButton);
    await btn.click();
    console.log("[search-form] Clicked search button");
  } catch (e) {
    console.warn(`[search-form] Could not click search button: ${e}`);
  }

  // Wait for the loading animation to appear (confirms search was submitted)
  console.log("[search-form] Waiting for search to start...");
  await new Promise((r) => setTimeout(r, 3000));

  // Poll until the loading indicator disappears or we see flight results
  console.log("[search-form] Waiting for results to load...");
  const startTime = Date.now();
  const maxWait = TIMEOUTS.searchResults; // 90s

  while (Date.now() - startTime < maxWait) {
    // Check if any loading indicators are still visible
    let isLoading = false;
    for (const selector of AWARD_FORM_SELECTORS.loadingSpinner) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
        isLoading = true;
        break;
      }
    }

    // Also check for the "Loading" text overlay
    const loadingText = page.locator('text=Loading').first();
    if (await loadingText.isVisible({ timeout: 500 }).catch(() => false)) {
      isLoading = true;
    }

    if (!isLoading) {
      console.log("[search-form] Loading complete!");
      break;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[search-form] Still loading... (${elapsed}s)`);
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Extra wait for dynamic content to finish rendering
  await new Promise((r) => setTimeout(r, 5000));

  // Debug: capture screenshot and HTML
  try {
    const screenshotPath = resolve(DEBUG_DIR, "debug-award-results.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[search-form] Screenshot saved to ${screenshotPath}`);
  } catch (e) {
    console.warn(`[search-form] Failed to save screenshot: ${e}`);
  }

  try {
    const htmlPath = resolve(DEBUG_DIR, "debug-award-results.html");
    const html = await page.content();
    writeFileSync(htmlPath, html);
    console.log(`[search-form] HTML saved to ${htmlPath}`);
  } catch (e) {
    console.warn(`[search-form] Failed to save HTML: ${e}`);
  }
}
