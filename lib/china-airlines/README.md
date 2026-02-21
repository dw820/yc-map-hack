# China Airlines Flight Search Scraper

Standalone module that scrapes [china-airlines.com/us/en](https://www.china-airlines.com/us/en) for one-way flight search results using **Browserbase** (cloud browser) + **Playwright** (automation).

## How It Works

1. **Browserbase** provides a cloud-hosted Chrome browser with persistent contexts (cookies/session state survive across sessions)
2. **Playwright** automates the China Airlines booking form: selects trip type, fills origin/destination, picks a date, and submits the search
3. Results are extracted via two strategies:
   - **Primary**: Network interception — captures JSON API responses the site makes internally (more reliable)
   - **Fallback**: DOM scraping — parses flight cards from the rendered HTML

## File Overview

| File | Purpose |
|------|---------|
| `index.ts` | Public API — exports `searchFlights()` with retry logic |
| `types.ts` | Zod schemas for input validation and typed output (`FlightSearchInput`, `FlightOption`, `FlightSearchResult`) |
| `browser-session.ts` | Browserbase session/context management (singleton, persistent cookies) |
| `search-form.ts` | Fills and submits the China Airlines booking form with human-like delays |
| `parse-results.ts` | Extracts flight data from intercepted API responses or DOM |
| `config.ts` | URLs, timeouts, CSS selectors (selectors need refinement after first live run) |
| `errors.ts` | `SearchError` class with typed error codes |
| `test-search.ts` | Standalone test script |

## Usage

```typescript
import { searchFlights } from "./lib/china-airlines/index.js";

const result = await searchFlights({
  origin: "TPE",
  destination: "NRT",
  departureDate: "2026-04-15",
  cabinClass: "economy",
  adults: 1,
});

console.log(result.outbound); // FlightOption[]
```

## Environment Variables

```
BROWSERBASE_API_KEY=<required>
BROWSERBASE_PROJECT_ID=<required>
CHINA_AIRLINES_CONTEXT_ID=<optional, auto-created on first run>
```

## Testing

```bash
npx tsx lib/china-airlines/test-search.ts
```

After the first run, check the Browserbase dashboard session replay to verify form interaction worked correctly. CSS selectors in `config.ts` are initial guesses and should be refined based on the actual DOM structure observed in the replay.

## Scope

- **v1**: One-way flights only
- Round-trip support planned for later
- Designed to integrate as an MCP tool in the parent mcp-use server (Step 7 in the plan)
