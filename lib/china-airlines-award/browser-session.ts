import Browserbase from "@browserbasehq/sdk";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { TIMEOUTS } from "./config.js";
import { AwardSearchError } from "./errors.js";

export interface BrowserSession {
  sessionId: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  debugUrl: string;
  close: () => Promise<void>;
}

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new AwardSearchError("SESSION_ERROR", `Missing environment variable: ${name}`);
  }
  return value;
}

export class AwardBrowserSessionManager {
  private static instance: AwardBrowserSessionManager | null = null;
  private activeSession: BrowserSession | null = null;
  private bb: Browserbase;
  private projectId: string;
  public lastCreatedContextId: string | null = null;

  private constructor() {
    const apiKey = getEnvOrThrow("BROWSERBASE_API_KEY");
    this.projectId = getEnvOrThrow("BROWSERBASE_PROJECT_ID");
    this.bb = new Browserbase({ apiKey });
  }

  static getInstance(): AwardBrowserSessionManager {
    if (!AwardBrowserSessionManager.instance) {
      AwardBrowserSessionManager.instance = new AwardBrowserSessionManager();
    }
    return AwardBrowserSessionManager.instance;
  }

  async getOrCreateContext(): Promise<string> {
    if (this.lastCreatedContextId) {
      console.log(`[award-session] Reusing context: ${this.lastCreatedContextId}`);
      return this.lastCreatedContextId;
    }

    const existingId = process.env.DYNASTY_FLYER_CONTEXT_ID;
    if (existingId) {
      console.log(`[award-session] Using existing context: ${existingId}`);
      this.lastCreatedContextId = existingId;
      return existingId;
    }

    console.log("[award-session] Creating new Browserbase context...");
    const context = await this.bb.contexts.create({
      projectId: this.projectId,
    });
    console.log(`[award-session] Created context: ${context.id}`);
    console.log(
      `[award-session] Set DYNASTY_FLYER_CONTEXT_ID=${context.id} to reuse this context`
    );
    this.lastCreatedContextId = context.id;
    return context.id;
  }

  async createSession(): Promise<BrowserSession> {
    if (this.activeSession) {
      throw new AwardSearchError(
        "SESSION_ERROR",
        "A session is already active. Close it before creating a new one."
      );
    }

    const contextId = await this.getOrCreateContext();

    console.log("[award-session] Creating Browserbase session...");
    const session = await this.bb.sessions.create({
      projectId: this.projectId,
      browserSettings: {
        context: { id: contextId, persist: true },
        blockAds: true,
      },
    });
    console.log(`[award-session] Session created: ${session.id}`);
    console.log(
      `[award-session] Replay: https://browserbase.com/sessions/${session.id}`
    );

    // Get debug URL for live viewing
    let debugUrl = `https://browserbase.com/sessions/${session.id}`;
    try {
      const debugInfo = await this.bb.sessions.debug(session.id);
      if (debugInfo.debuggerFullscreenUrl) {
        debugUrl = debugInfo.debuggerFullscreenUrl;
      }
    } catch (e) {
      console.warn(`[award-session] Could not get debug URL: ${e}`);
    }
    console.log(`[award-session] Debug URL: ${debugUrl}`);

    const browser = await chromium.connectOverCDP(session.connectUrl, {
      timeout: TIMEOUTS.pageLoad,
    });

    const contexts = browser.contexts();
    const context = contexts[0];
    if (!context) {
      throw new AwardSearchError("SESSION_ERROR", "No browser context available after connect");
    }
    const pages = context.pages();
    const page = pages[0] || (await context.newPage());

    page.setDefaultTimeout(TIMEOUTS.elementInteraction);

    const closeSession = async () => {
      console.log("[award-session] Closing session...");
      try {
        await page.close().catch(() => {});
        await browser.close().catch(() => {});
        await new Promise((r) => setTimeout(r, TIMEOUTS.contextSync));
      } finally {
        this.activeSession = null;
      }
      console.log("[award-session] Session closed.");
    };

    this.activeSession = {
      sessionId: session.id,
      browser,
      context,
      page,
      debugUrl,
      close: closeSession,
    };

    return this.activeSession;
  }
}
