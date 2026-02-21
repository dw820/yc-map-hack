import type { Page } from "playwright-core";
import {
  DYNASTY_FLYER_LOGIN_URL,
  DYNASTY_FLYER_DOMAIN_PATTERN,
  AUTH_REDIRECT_URL_PATTERN,
  LOGIN_SELECTORS,
  TIMEOUTS,
} from "./config.js";
import { AwardSearchError } from "./errors.js";
import { AwardBrowserSessionManager, type BrowserSession } from "./browser-session.js";

/** Start a new browser session and navigate to the Dynasty Flyer login page */
export async function startLoginSession(): Promise<{
  session: BrowserSession;
  contextId: string;
}> {
  const manager = AwardBrowserSessionManager.getInstance();
  const contextId = await manager.getOrCreateContext();
  const session = await manager.createSession();

  console.log("[login] Navigating to Dynasty Flyer login page...");
  await session.page.goto(DYNASTY_FLYER_LOGIN_URL, {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUTS.pageLoad,
  });

  // Wait for login page to render
  await new Promise((r) => setTimeout(r, 3000));

  return { session, contextId };
}

/**
 * Poll for login completion.
 * Checks every `loginPollInterval` ms whether the user has completed login.
 *
 * IMPORTANT: This function NEVER navigates the page. It passively observes
 * the current URL and DOM to avoid disrupting intermediate auth flows
 * (email verification, OTP entry, etc.) on dynasty-flyer.china-airlines.com.
 */
export async function pollForLoginCompletion(
  page: Page,
  timeoutMs: number = TIMEOUTS.loginPolling
): Promise<boolean> {
  const startTime = Date.now();
  const interval = TIMEOUTS.loginPollInterval;

  console.log(
    `[login] Polling for login completion (timeout: ${timeoutMs / 1000}s)...`
  );

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((r) => setTimeout(r, interval));

    const currentUrl = page.url();

    // Still on dynasty-flyer domain (login, email verify, OTP, etc.) — keep waiting
    if (DYNASTY_FLYER_DOMAIN_PATTERN.test(currentUrl)) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(
        `[login] User still on auth flow: ${currentUrl} (${elapsed}s elapsed)`
      );
      continue;
    }

    // Redirected to china-airlines.com — login likely succeeded
    if (AUTH_REDIRECT_URL_PATTERN.test(currentUrl)) {
      console.log(`[login] Redirected to: ${currentUrl}`);

      // Give the page time to fully load after redirect
      await new Promise((r) => setTimeout(r, 3000));

      // Passively check for logged-in indicators on the current page
      const authResult = await checkAuthStatusPassive(page);
      if (authResult.authenticated) {
        console.log(
          `[login] Login successful! Member: ${authResult.memberName ?? "unknown"}`
        );
        return true;
      }

      console.log("[login] On china-airlines.com but no auth indicators yet, continuing to poll...");
      continue;
    }

    // On some other domain entirely — check for logged-in indicators passively
    console.log(`[login] Unexpected URL: ${currentUrl}, checking for auth indicators...`);
    const authResult = await checkAuthStatusPassive(page);
    if (authResult.authenticated) {
      console.log(
        `[login] Login successful! Member: ${authResult.memberName ?? "unknown"}`
      );
      return true;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[login] Still waiting for login... (${elapsed}s elapsed)`);
  }

  throw new AwardSearchError(
    "LOGIN_TIMEOUT",
    `Login was not completed within ${timeoutMs / 1000} seconds. Please try again.`
  );
}

/**
 * Passively check if the current page shows logged-in indicators.
 * NEVER navigates — only inspects the DOM of whatever page the user is currently on.
 */
async function checkAuthStatusPassive(
  page: Page
): Promise<{ authenticated: boolean; memberName?: string }> {
  // Check for logged-in indicators
  for (const selector of LOGIN_SELECTORS.loggedInIndicators) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        const name = await el.textContent().catch(() => null);
        console.log(`[login] Auth confirmed via: ${selector}`);
        return {
          authenticated: true,
          memberName: name?.trim() || undefined,
        };
      }
    } catch {
      continue;
    }
  }

  // Check member menu triggers as secondary indicator
  for (const selector of LOGIN_SELECTORS.memberMenuTrigger) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        const text = await el.textContent().catch(() => "");
        if (text && !LOGIN_SELECTORS.notLoggedInPatterns.test(text)) {
          console.log(`[login] Auth confirmed via member menu: ${selector}`);
          return {
            authenticated: true,
            memberName: text.trim() || undefined,
          };
        }
      }
    } catch {
      continue;
    }
  }

  return { authenticated: false };
}

