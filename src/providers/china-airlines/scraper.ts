export interface RawScrapedData {
  html?: string;
  text?: string;
  data?: unknown;
}

export interface ScraperBackend {
  name: string;
  scrape(url: string, instructions: string): Promise<RawScrapedData>;
}

export function createScraperBackend(backend: string): ScraperBackend {
  switch (backend) {
    case "browserbase": {
      const { BrowserBaseScraper } = require("./scrapers/browserbase.js");
      return new BrowserBaseScraper();
    }
    case "firecrawl": {
      const { FirecrawlScraper } = require("./scrapers/firecrawl.js");
      return new FirecrawlScraper();
    }
    default:
      throw new Error(`Unknown scraper backend: ${backend}`);
  }
}
