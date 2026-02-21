# lib/points-bazaar

Scraper module for the [PointsBazaar](https://pointsbazaar.com) P2P airline miles marketplace. Constructs search URLs, scrapes the rendered React SPA via Firecrawl, and extracts structured listing data.

## How It Works

```
                          lib/points-bazaar
 ┌──────────────────────────────────────────────────────────────────┐
 │                                                                  │
 │   searchListings(input)         ← entry point (index.ts)        │
 │       │                                                          │
 │       ▼                                                          │
 │   ┌──────────────┐                                               │
 │   │  Validate     │  Zod schema check (types.ts)                 │
 │   │  Input        │  airline, milesRange, unitPriceRange          │
 │   └──────┬───────┘                                               │
 │          │                                                       │
 │          ▼                                                       │
 │   ┌──────────────┐                                               │
 │   │  Build URL    │  config.ts                                   │
 │   │              │  pointsbazaar.com/mileage/selling?airline=CI  │
 │   └──────┬───────┘                                               │
 │          │                                                       │
 │          ▼                                                       │
 │   ┌──────────────┐    ┌─────────────────────────────────┐        │
 │   │  Scrape via   │───▶│  Firecrawl API                  │        │
 │   │  Firecrawl    │◀───│  - renders React SPA            │        │
 │   │              │    │  - waits 3s for hydration        │        │
 │   └──────┬───────┘    │  - returns markdown + html       │        │
 │          │            └─────────────────────────────────┘        │
 │          ▼                                                       │
 │   ┌──────────────┐                                               │
 │   │  Parse        │  parse-results.ts                            │
 │   │  Results      │  Strategy 1: markdown table rows             │
 │   │              │  Strategy 2: text blocks with regex           │
 │   └──────┬───────┘                                               │
 │          │                                                       │
 │          ▼                                                       │
 │   ┌──────────────┐                                               │
 │   │  Return       │  RawPointsListing[]                          │
 │   │  Listings     │  { airline, miles, $/mile, seller, ... }     │
 │   └──────────────┘                                               │
 │                                                                  │
 │   On failure: retry up to 2x with exponential backoff            │
 │   Permanent errors (INVALID_INPUT) skip retries                  │
 │                                                                  │
 └──────────────────────────────────────────────────────────────────┘
```

## File Map

```
lib/points-bazaar/
├── index.ts              Main orchestrator — searchListings()
├── types.ts              Zod schemas: input, listing, result
├── config.ts             URL builder, airline IATA map, Firecrawl settings
├── firecrawl-client.ts   Firecrawl SDK wrapper — scrape()
├── parse-results.ts      Extract listings from scraped markdown/HTML
└── errors.ts             ListingSearchError with typed error codes
```

## Data Flow in Context

This library is the low-level scraper. Here's where it fits in the full stack:

```
User asks: "Find CI miles for sale"
        │
        ▼
┌─────────────────┐
│  MCP Tool        │  index.ts → search-points-listings
│  (server layer)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Service Layer   │  src/services/points-listing-service.ts
│  (cache + logic) │  5-min TTL cache
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Provider        │  src/providers/points-bazaar/provider.ts
│  (adapter)       │  or mock provider when DATA_MODE=mock
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  THIS LIBRARY    │  lib/points-bazaar/
│  (scraper)       │  URL → Firecrawl → parse → listings
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Widget          │  resources/points-listing-result/
│  (UI)            │  sortable table with filters
└─────────────────┘
```

## URL Construction

PointsBazaar supports direct URL-based search — no form automation needed:

```
https://pointsbazaar.com/mileage/selling?airline=CI&milesRange=unlimited&unitPriceRange=unlimited
                                          │          │                    │
                                          │          │                    └─ price filter
                                          │          └─ quantity filter
                                          └─ IATA code ("" for all)
```

## Parsing Strategies

The parser handles two common page layouts returned by Firecrawl:

**Strategy 1 — Markdown tables** (preferred)

```
| Airline | Miles   | $/Mile | Total  | Seller      |
|---------|---------|--------|--------|-------------|
| CI      | 35,000  | $0.014 | $490   | AsiaFlyer   |
```

Splits by `|`, extracts miles/price with regex, maps IATA codes to airline names.

**Strategy 2 — Text blocks** (fallback)

Splits markdown on `---` or headings, then scans each block for:
- Miles quantity: `35,000 miles`
- Price per mile: `$0.014/mile`
- Total price: `total: $490`
- Seller name: `seller: AsiaFlyer`
- Rating: `4.6/5`

## Error Handling

| Code | Meaning | Retries? |
|------|---------|----------|
| `INVALID_INPUT` | Bad search params (Zod validation failed) | No |
| `API_ERROR` | Firecrawl SDK error or missing API key | Yes |
| `TIMEOUT` | Firecrawl request timed out | Yes |
| `PARSE_ERROR` | Could not extract listings from response | Yes |
| `NO_RESULTS` | Page loaded but no listings found | Yes |

Retry policy: up to 2 retries with exponential backoff (3s, 6s).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FIRECRAWL_API_KEY` | Yes (live mode) | API key from [firecrawl.dev](https://firecrawl.dev) |
| `DATA_MODE` | No | `mock` (default) or `live` — controls provider selection at the service layer |

## Supported Airlines

The `config.ts` maps 20 airlines to IATA codes for URL construction and result parsing:

```
AA  American Airlines       UA  United Airlines        DL  Delta Air Lines
CI  China Airlines          BR  EVA Air                BA  British Airways
SQ  Singapore Airlines      CX  Cathay Pacific         EK  Emirates
JL  Japan Airlines          NH  ANA                    KE  Korean Air
AF  Air France              LH  Lufthansa              QF  Qantas
WN  Southwest Airlines      B6  JetBlue                AC  Air Canada
TK  Turkish Airlines        AS  Alaska Airlines
```

## Example

```typescript
import { searchListings } from "./lib/points-bazaar/index.js";

const result = await searchListings({
  airline: "CI",
  milesRange: "unlimited",
  unitPriceRange: "unlimited",
});

// result.listings[0]:
// {
//   id: "pb-0-1708560000000",
//   airline: "China Airlines",
//   loyaltyProgram: "Dynasty Flyer",
//   milesAvailable: 35000,
//   pricePerMile: 0.014,
//   totalPrice: 490,
//   sellerDisplayName: "AsiaFlyer",
//   sellerRating: 4.6,
//   listingStatus: "active"
// }
```
