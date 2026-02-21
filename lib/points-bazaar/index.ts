import { ListingSearchInputSchema } from "./types.js";
import type { ListingSearchInput, ListingSearchResult } from "./types.js";
import { ListingSearchError } from "./errors.js";
import { buildSearchUrl, FIRECRAWL_INSTRUCTIONS } from "./config.js";
import { scrapeWithFirecrawl } from "./firecrawl-client.js";
import { parseFirecrawlResults } from "./parse-results.js";

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 3_000;
const PERMANENT_ERRORS = new Set<string>(["INVALID_INPUT"]);

export async function searchListings(
  rawInput: ListingSearchInput
): Promise<ListingSearchResult> {
  const parseResult = ListingSearchInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    throw new ListingSearchError(
      "INVALID_INPUT",
      `Invalid search input: ${parseResult.error.message}`
    );
  }
  const input = parseResult.data;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.log(
        `[points-bazaar] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const url = buildSearchUrl(
        input.airline,
        input.milesRange,
        input.unitPriceRange
      );
      console.log(`[points-bazaar] Scraping: ${url}`);

      const scraped = await scrapeWithFirecrawl(url, FIRECRAWL_INSTRUCTIONS);
      const listings = parseFirecrawlResults(scraped, input.airline);

      if (listings.length === 0) {
        throw new ListingSearchError(
          "NO_RESULTS",
          `No listings found for airline: ${input.airline}`
        );
      }

      return {
        listings,
        searchInput: input,
        timestamp: new Date().toISOString(),
        resultCount: listings.length,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[points-bazaar] Attempt ${attempt + 1} failed: ${lastError.message}`
      );

      if (
        err instanceof ListingSearchError &&
        PERMANENT_ERRORS.has(err.code)
      ) {
        throw err;
      }
    }
  }

  throw (
    lastError ||
    new ListingSearchError("TIMEOUT", "Search failed after all retries")
  );
}
