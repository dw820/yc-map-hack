import type { FirecrawlResult } from "./firecrawl-client.js";
import type { RawPointsListing } from "./types.js";
import { IATA_TO_AIRLINE } from "./config.js";

/**
 * Parse listing data from Firecrawl's markdown output.
 * Uses regex patterns to extract listing cards from the rendered page.
 */
export function parseListingsFromMarkdown(
  markdown: string,
  airlineFilter: string
): RawPointsListing[] {
  const listings: RawPointsListing[] = [];

  // Strategy 1: Look for table rows (markdown tables)
  const tableRows = markdown.match(/\|[^|]+\|[^|]+\|[^|]+\|/g);
  if (tableRows && tableRows.length > 1) {
    // Skip header row
    for (let i = 1; i < tableRows.length; i++) {
      const cells = tableRows[i]
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      const listing = parseTableRow(cells, i, airlineFilter);
      if (listing) listings.push(listing);
    }
    if (listings.length > 0) return listings;
  }

  // Strategy 2: Look for listing blocks separated by horizontal rules or headings
  const blocks = markdown.split(/(?:^---$|^#{1,3}\s)/m).filter((b) => b.trim());
  for (let i = 0; i < blocks.length; i++) {
    const listing = parseListingBlock(blocks[i], i, airlineFilter);
    if (listing) listings.push(listing);
  }

  return listings;
}

function parseTableRow(
  cells: string[],
  index: number,
  airlineFilter: string
): RawPointsListing | null {
  if (cells.length < 3) return null;

  const text = cells.join(" ");
  const milesMatch = text.match(/([\d,]+)\s*(?:miles|mi)/i);
  const priceMatch = text.match(/\$?([\d.]+)\s*(?:\/\s*(?:mile|mi|point|pt))?/i);

  if (!milesMatch || !priceMatch) return null;

  const miles = parseInt(milesMatch[1].replace(/,/g, ""), 10);
  const price = parseFloat(priceMatch[1]);
  const pricePerMile = price < 1 ? price : price / miles;

  const airline =
    airlineFilter !== "all"
      ? IATA_TO_AIRLINE[airlineFilter] || airlineFilter
      : extractAirline(text);

  return {
    id: `pb-${index}-${Date.now()}`,
    airline,
    milesAvailable: miles,
    pricePerMile: Math.round(pricePerMile * 10000) / 10000,
    totalPrice: Math.round(miles * pricePerMile * 100) / 100,
    listingStatus: "active",
  };
}

function parseListingBlock(
  block: string,
  index: number,
  airlineFilter: string
): RawPointsListing | null {
  const milesMatch = block.match(/([\d,]+)\s*(?:miles|mi)/i);
  const pricePerMileMatch = block.match(
    /\$?([\d.]+)\s*(?:per\s+(?:mile|mi|point|pt)|\/\s*(?:mile|mi|point|pt))/i
  );
  const totalPriceMatch = block.match(
    /(?:total|price)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i
  );
  const sellerMatch = block.match(/(?:seller|by|from)[:\s]*([A-Za-z0-9_]+)/i);
  const ratingMatch = block.match(/([\d.]+)\s*(?:\/\s*5|stars?|rating)/i);

  if (!milesMatch) return null;

  const miles = parseInt(milesMatch[1].replace(/,/g, ""), 10);
  if (miles <= 0) return null;

  let pricePerMile = 0;
  if (pricePerMileMatch) {
    pricePerMile = parseFloat(pricePerMileMatch[1]);
  } else if (totalPriceMatch) {
    const total = parseFloat(totalPriceMatch[1].replace(/,/g, ""));
    pricePerMile = total / miles;
  }

  if (pricePerMile <= 0) return null;

  const airline =
    airlineFilter !== "all"
      ? IATA_TO_AIRLINE[airlineFilter] || airlineFilter
      : extractAirline(block);

  return {
    id: `pb-${index}-${Date.now()}`,
    airline,
    loyaltyProgram: extractLoyaltyProgram(block),
    milesAvailable: miles,
    pricePerMile: Math.round(pricePerMile * 10000) / 10000,
    totalPrice: totalPriceMatch
      ? parseFloat(totalPriceMatch[1].replace(/,/g, ""))
      : Math.round(miles * pricePerMile * 100) / 100,
    sellerDisplayName: sellerMatch ? sellerMatch[1] : undefined,
    sellerRating: ratingMatch ? parseFloat(ratingMatch[1]) : undefined,
    listingStatus: "active",
  };
}

function extractAirline(text: string): string {
  for (const [name, _code] of Object.entries(
    // Import at module level already
    IATA_TO_AIRLINE
  )) {
    // Check IATA codes
    if (new RegExp(`\\b${name}\\b`, "i").test(text)) {
      return IATA_TO_AIRLINE[name] || name;
    }
  }

  // Check airline names from the reverse map
  const airlineNames = Object.keys(
    Object.fromEntries(
      Object.entries(IATA_TO_AIRLINE).map(([code, name]) => [name, code])
    )
  );
  for (const name of airlineNames) {
    if (text.toLowerCase().includes(name.toLowerCase())) {
      return name;
    }
  }

  return "Unknown";
}

function extractLoyaltyProgram(text: string): string | undefined {
  const programs: Record<string, string> = {
    AAdvantage: "AAdvantage",
    MileagePlus: "MileagePlus",
    SkyMiles: "SkyMiles",
    "Dynasty Flyer": "Dynasty Flyer",
    "Executive Club": "Executive Club",
    KrisFlyer: "KrisFlyer",
    "Asia Miles": "Asia Miles",
    Skywards: "Skywards",
    "Mileage Bank": "Mileage Bank",
  };

  for (const [key, value] of Object.entries(programs)) {
    if (text.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  return undefined;
}

/**
 * Main parse function — tries markdown extraction.
 */
export function parseFirecrawlResults(
  result: FirecrawlResult,
  airlineFilter: string
): RawPointsListing[] {
  if (result.markdown) {
    const listings = parseListingsFromMarkdown(result.markdown, airlineFilter);
    if (listings.length > 0) return listings;
  }

  return [];
}
