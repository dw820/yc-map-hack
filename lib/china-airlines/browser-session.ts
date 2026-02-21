import Browserbase from "@browserbasehq/sdk";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { TIMEOUTS } from "./config.js";
import { SearchError } from "./errors.js";

export interface BrowserSession {
  sessionId: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new SearchError("SESSION_ERROR", `Missing environment variable: ${name}`);
  }
  return value;
}

export class BrowserSessionManager {
  private static instance: BrowserSessionManager | null = null;
  private activeSession: BrowserSession | null = null;
  private bb: Browserbase;
  private projectId: string;
  public lastCreatedContextId: string | null = null;

  private constructor() {
    const apiKey = getEnvOrThrow("BROWSERBASE_API_KEY");
    this.projectId = getEnvOrThrow("BROWSERBASE_PROJECT_ID");
    this.bb = new Browserbase({ apiKey });
  }

  static getInstance(): BrowserSessionManager {
    if (!BrowserSessionManager.instance) {
      BrowserSessionManager.instance = new BrowserSessionManager();
    }
    return BrowserSessionManager.instance;
  }

  async getOrCreateContext(): Promise<string> {
    // Reuse context from this process if already created
    if (this.lastCreatedContextId) {
      console.log(`[browser-session] Reusing context: ${this.lastCreatedContextId}`);
      return this.lastCreatedContextId;
    }

    const existingId = process.env.CHINA_AIRLINES_CONTEXT_ID;
    if (existingId) {
      console.log(`[browser-session] Using existing context: ${existingId}`);
      this.lastCreatedContextId = existingId;
      return existingId;
    }

    console.log("[browser-session] Creating new Browserbase context...");
    const context = await this.bb.contexts.create({
      projectId: this.projectId,
    });
    console.log(`[browser-session] Created context: ${context.id}`);
    console.log(
      `[browser-session] Set CHINA_AIRLINES_CONTEXT_ID=${context.id} to reuse this context`
    );
    this.lastCreatedContextId = context.id;
    return context.id;
  }

  async createSession(): Promise<BrowserSession> {
    if (this.activeSession) {
      throw new SearchError(
        "SESSION_ERROR",
        "A session is already active. Close it before creating a new one."
      );
    }

    const contextId = await this.getOrCreateContext();

    console.log("[browser-session] Creating Browserbase session...");
    const session = await this.bb.sessions.create({
      projectId: this.projectId,
      browserSettings: {
        context: { id: contextId, persist: true },
        blockAds: true,
      },
    });
    console.log(`[browser-session] Session created: ${session.id}`);
    console.log(
      `[browser-session] Replay: https://browserbase.com/sessions/${session.id}`
    );

    const browser = await chromium.connectOverCDP(session.connectUrl, {
      timeout: TIMEOUTS.pageLoad,
    });

    const contexts = browser.contexts();
    const context = contexts[0];
    if (!context) {
      throw new SearchError("SESSION_ERROR", "No browser context available after connect");
    }
    const pages = context.pages();
    const page = pages[0] || (await context.newPage());

    page.setDefaultTimeout(TIMEOUTS.elementInteraction);

    const closeSession = async () => {
      console.log("[browser-session] Closing session...");
      try {
        await page.close().catch(() => {});
        await browser.close().catch(() => {});
        // Wait for context to sync cookies/state
        await new Promise((r) => setTimeout(r, TIMEOUTS.contextSync));
      } finally {
        this.activeSession = null;
      }
      console.log("[browser-session] Session closed.");
    };

    this.activeSession = {
      sessionId: session.id,
      browser,
      context,
      page,
      close: closeSession,
    };

    return this.activeSession;
  }
}
