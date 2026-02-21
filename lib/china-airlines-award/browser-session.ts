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
  public lastSessionId: string | null = null;

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

  getSessionId(): string | null {
    return this.lastSessionId ?? process.env.DYNASTY_FLYER_SESSION_ID ?? null;
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
      keepAlive: true,
      timeout: TIMEOUTS.browserbaseSessionTimeout,
      browserSettings: {
        context: { id: contextId, persist: true },
        blockAds: true,
      },
    });
    this.lastSessionId = session.id;
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

    const disconnectSession = async () => {
      console.log("[award-session] Disconnecting from session...");
      try {
        await browser.close().catch(() => {});
        // No page.close() — keep pages alive in Browserbase
        // No contextSync delay — session stays alive with keepAlive
      } finally {
        this.activeSession = null;
      }
      console.log("[award-session] Disconnected (session still alive in Browserbase).");
    };

    this.activeSession = {
      sessionId: session.id,
      browser,
      context,
      page,
      debugUrl,
      close: disconnectSession,
    };

    return this.activeSession;
  }

  async reconnectToSession(sessionId: string): Promise<BrowserSession> {
    if (this.activeSession) {
      throw new AwardSearchError(
        "SESSION_ERROR",
        "A session is already active. Close it before reconnecting."
      );
    }

    console.log(`[award-session] Reconnecting to session: ${sessionId}`);
    const session = await this.bb.sessions.retrieve(sessionId);
    if (session.status !== "RUNNING") {
      throw new AwardSearchError(
        "AUTH_REQUIRED",
        `Session expired (status: ${session.status}). Please re-login.`
      );
    }

    // Get debug URL for live viewing
    let debugUrl = `https://browserbase.com/sessions/${sessionId}`;
    try {
      const debugInfo = await this.bb.sessions.debug(sessionId);
      if (debugInfo.debuggerFullscreenUrl) {
        debugUrl = debugInfo.debuggerFullscreenUrl;
      }
    } catch (e) {
      console.warn(`[award-session] Could not get debug URL: ${e}`);
    }
    console.log(`[award-session] Debug URL: ${debugUrl}`);

    if (!session.connectUrl) {
      throw new AwardSearchError("SESSION_ERROR", "Session has no connect URL. It may have expired.");
    }

    const browser = await chromium.connectOverCDP(session.connectUrl, {
      timeout: TIMEOUTS.pageLoad,
    });

    const contexts = browser.contexts();
    const context = contexts[0];
    if (!context) {
      throw new AwardSearchError("SESSION_ERROR", "No browser context available after reconnect");
    }
    const pages = context.pages();
    const page = pages[0] || (await context.newPage());

    page.setDefaultTimeout(TIMEOUTS.elementInteraction);

    const disconnectSession = async () => {
      console.log("[award-session] Disconnecting from session...");
      try {
        await browser.close().catch(() => {});
      } finally {
        this.activeSession = null;
      }
      console.log("[award-session] Disconnected (session still alive in Browserbase).");
    };

    this.activeSession = {
      sessionId,
      browser,
      context,
      page,
      debugUrl,
      close: disconnectSession,
    };

    console.log("[award-session] Reconnected successfully.");
    return this.activeSession;
  }

  async releaseSession(sessionId: string): Promise<void> {
    console.log(`[award-session] Releasing session: ${sessionId}`);
    await this.bb.sessions.update(sessionId, {
      status: "REQUEST_RELEASE",
      projectId: this.projectId,
    });
    console.log("[award-session] Session released.");
  }
}
