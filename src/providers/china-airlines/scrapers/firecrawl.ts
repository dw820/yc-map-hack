import type { RawScrapedData, ScraperBackend } from "../scraper.js";

export class FirecrawlScraper implements ScraperBackend {
  name = "firecrawl";

  async scrape(url: string, instructions: string): Promise<RawScrapedData> {
    // Stub — real implementation will use Firecrawl API
    throw new Error(
      `Firecrawl scraper not yet implemented. URL: ${url}, Instructions: ${instructions}`
    );
  }
}
