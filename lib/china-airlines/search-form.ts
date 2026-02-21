import { writeFileSync } from "fs";
import { resolve } from "path";
import type { Page } from "playwright-core";
import { CHINA_AIRLINES_URL, SELECTORS, TIMEOUTS, DELAYS } from "./config.js";
import { SearchError } from "./errors.js";
import type { FlightSearchInput } from "./types.js";

const DEBUG_DIR = resolve(import.meta.dirname);

/** Human-like delay to avoid bot detection */
async function humanDelay(multiplier = 1): Promise<void> {
  const jitter = Math.random() * DELAYS.jitterMax;
  const ms = (DELAYS.base + jitter) * multiplier;
  await new Promise((r) => setTimeout(r, ms));
}

/** Navigate to China Airlines homepage and wait for page ready */
async function navigateToSite(page: Page): Promise<void> {
  console.log("[search-form] Navigating to China Airlines...");
  await page.goto(CHINA_AIRLINES_URL, {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUTS.pageLoad,
  });
  // Let AngularJS bootstrap and render
  await new Promise((r) => setTimeout(r, 5000));

  // Dismiss cookie consent or popups if present
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
    // No popup, continue
  }
}

/** Select "One Way" trip type via the custom dropdown */
async function selectOneWay(page: Page): Promise<void> {
  console.log("[search-form] Selecting One Way trip type...");

  // Click the dropdown button to open it
  const dropdownBtn = page.locator(SELECTORS.tripTypeDropdownButton);
  await dropdownBtn.click();
  await humanDelay(0.5);

  // Click the "One way" option
  const oneWayOption = page.locator(SELECTORS.oneWayDropdownOption);
  await oneWayOption.click();
  await humanDelay();
  console.log("[search-form] Selected One Way");
}

/**
 * Fill an airport field. China Airlines uses a text input that, when typed into,
 * shows matching airports inline. We type the IATA code and pick from the results.
 */
async function fillAirportField(
  page: Page,
  inputSelector: string,
  code: string,
  label: string
): Promise<void> {
  console.log(`[search-form] Filling ${label}: ${code}...`);

  const input = page.locator(inputSelector);
  await input.click();
  await humanDelay(0.5);

  // Clear and type the IATA code
  await input.fill("");
  await humanDelay(0.3);
  await input.pressSequentially(code, { delay: 120 });
  await humanDelay();

  // The site may show an airport popup modal or inline suggestions.
  // Wait a moment for suggestions to appear, then check what we have.
  await new Promise((r) => setTimeout(r, 1500));

  // Try: click the popup "Select" button if the modal appeared
  try {
    const selectBtn = page.locator(SELECTORS.airportPopupSelectBtn);
    if (await selectBtn.isVisible({ timeout: 2000 })) {
      await selectBtn.click();
      console.log(`[search-form] Selected ${code} via popup modal`);
      await humanDelay();
      return;
    }
  } catch {}

  // Try: click a suggestion that contains the IATA code
  try {
    const suggestion = page
      .locator(`li:has-text("${code}"), .airport-item:has-text("${code}")`)
      .first();
    if (await suggestion.isVisible({ timeout: 2000 })) {
      await suggestion.click();
      console.log(`[search-form] Selected ${code} from suggestion list`);
      await humanDelay();
      return;
    }
  } catch {}

  // Fallback: just press Enter or Tab to confirm the typed value
  await input.press("Enter");
  await humanDelay();
  console.log(`[search-form] Confirmed ${code} via Enter key`);
}

/**
 * Select departure date.
 * Primary approach: type directly into the #oneWayDate input in DD/MM/YYYY format.
 * Fallback: use the calendar month-jump dropdown and click the day cell.
 */
async function selectDepartureDate(page: Page, dateStr: string): Promise<void> {
  console.log(`[search-form] Selecting departure date: ${dateStr}...`);
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const dd = dayStr.padStart(2, "0");
  const mm = monthStr.padStart(2, "0");
  const formattedDate = `${dd}/${mm}/${yearStr}`; // DD/MM/YYYY

  // Primary: type into the oneWayDate input directly
  const dateInput = page.locator("#oneWayDate");
  if (await dateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dateInput.click();
    await humanDelay(0.3);
    await dateInput.fill(formattedDate);
    await humanDelay(0.3);
    await dateInput.press("Enter");
    console.log(`[search-form] Typed date: ${formattedDate}`);
    await humanDelay();
    return;
  }

  // Fallback: use the calendar UI
  console.log("[search-form] oneWayDate input not visible, using calendar...");
  const targetMonth = parseInt(monthStr, 10);
  const targetYear = parseInt(yearStr, 10);
  const targetDay = parseInt(dayStr, 10);
  const monthNames = [
    "",
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const targetLabel = `${monthNames[targetMonth]} ${targetYear}`;

  // Try month jump dropdown
  const monthSelect = page.locator(SELECTORS.monthJumpSelect);
  try {
    await monthSelect.selectOption({ label: targetLabel });
    console.log(`[search-form] Jumped to ${targetLabel}`);
    await humanDelay();
  } catch {
    // Click next month repeatedly
    for (let i = 0; i < 12; i++) {
      const heading = await page
        .locator(".calendar-datepicker strong")
        .first()
        .textContent()
        .catch(() => "");
      if (heading && heading.includes(monthNames[targetMonth]) && heading.includes(String(targetYear))) {
        break;
      }
      await page.locator(SELECTORS.calendarNextMonth).click();
      await humanDelay(0.5);
    }
  }

  // Click the target day
  const dayButton = page.locator(SELECTORS.calendarDayButton(targetDay)).first();
  await dayButton.click();
  console.log(`[search-form] Selected day ${targetDay}`);
  await humanDelay();
}

/** Select cabin class by clicking the cabin dropdown then the radio */
async function selectCabinClass(page: Page, cabinClass: string): Promise<void> {
  console.log(`[search-form] Selecting cabin class: ${cabinClass}...`);

  const radioSelector = SELECTORS.cabinRadio[cabinClass];
  if (!radioSelector) {
    console.warn(`[search-form] Unknown cabin class "${cabinClass}", skipping`);
    return;
  }

  // Open the cabin dropdown
  try {
    const trigger = page.locator(SELECTORS.cabinClassTrigger);
    await trigger.click();
    await humanDelay(0.5);
  } catch {
    // Dropdown might already be open
  }

  // Click the radio
  const radio = page.locator(radioSelector);
  await radio.click({ force: true });
  await humanDelay();
  console.log(`[search-form] Selected cabin: ${cabinClass}`);
}

/** Click the search button and wait for navigation/results */
async function submitSearch(page: Page): Promise<void> {
  console.log("[search-form] Submitting search...");

  const searchBtn = page.locator(SELECTORS.searchButton);
  await searchBtn.click();

  // Wait for navigation to results page or network idle
  console.log("[search-form] Waiting for results page...");
  try {
    await page.waitForURL("**/FlightSearchResults**", {
      timeout: TIMEOUTS.searchResults,
      waitUntil: "domcontentloaded",
    });
    console.log("[search-form] Arrived at results page");
  } catch {
    console.log("[search-form] No URL change detected, waiting for network idle...");
    await page
      .waitForLoadState("networkidle", { timeout: TIMEOUTS.searchResults })
      .catch(() => {});
  }

  // Extra wait for dynamic content to render
  await new Promise((r) => setTimeout(r, 5000));

  // Debug: capture results page screenshot and HTML
  try {
    const screenshotPath = resolve(DEBUG_DIR, "debug-results.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[search-form] Screenshot saved to ${screenshotPath}`);
  } catch (e) {
    console.warn(`[search-form] Failed to save screenshot: ${e}`);
  }

  try {
    const htmlPath = resolve(DEBUG_DIR, "debug-results.html");
    const html = await page.content();
    writeFileSync(htmlPath, html);
    console.log(`[search-form] HTML saved to ${htmlPath}`);
  } catch (e) {
    console.warn(`[search-form] Failed to save HTML: ${e}`);
  }
}

/** Full search form flow: navigate, fill, submit */
export async function fillAndSubmitSearchForm(
  page: Page,
  input: FlightSearchInput
): Promise<void> {
  await navigateToSite(page);
  await selectOneWay(page);
  await fillAirportField(page, SELECTORS.originInput, input.origin, "origin");
  await fillAirportField(page, SELECTORS.destinationInput, input.destination, "destination");
  await selectDepartureDate(page, input.departureDate);
  if (input.cabinClass !== "economy") {
    await selectCabinClass(page, input.cabinClass);
  }
  await submitSearch(page);
}
