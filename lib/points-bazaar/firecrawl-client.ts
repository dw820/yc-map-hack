import Firecrawl from "@mendable/firecrawl-js";
import { ListingSearchError } from "./errors.js";
import { FIRECRAWL_WAIT_MS } from "./config.js";

export interface FirecrawlResult {
  markdown?: string;
  html?: string;
  metadata?: Record<string, unknown>;
}

export async function scrapeWithFirecrawl(
  url: string,
  _instructions: string
): Promise<FirecrawlResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new ListingSearchError(
      "API_ERROR",
      "FIRECRAWL_API_KEY environment variable is not set"
    );
  }

  const client = new Firecrawl({ apiKey });

  try {
    const result = await client.scrape(url, {
      formats: ["markdown", "html"],
      actions: [{ type: "wait", milliseconds: FIRECRAWL_WAIT_MS }],
    });

    return {
      markdown: result.markdown,
      html: result.html,
      metadata: result.metadata as Record<string, unknown> | undefined,
    };
  } catch (err) {
    if (err instanceof ListingSearchError) throw err;

    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("timeout") || message.includes("TIMEOUT")) {
      throw new ListingSearchError(
        "TIMEOUT",
        `Firecrawl request timed out: ${message}`
      );
    }

    throw new ListingSearchError("API_ERROR", `Firecrawl error: ${message}`);
  }
}
