import type { RawScrapedData, ScraperBackend } from "../scraper.js";

export class BrowserBaseScraper implements ScraperBackend {
  name = "browserbase";

  async scrape(url: string, instructions: string): Promise<RawScrapedData> {
    // Stub — real implementation will use BrowserBase API
    throw new Error(
      `BrowserBase scraper not yet implemented. URL: ${url}, Instructions: ${instructions}`
    );
  }
}
