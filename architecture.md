# Architecture

Flight price/points comparison MCP server. Users search flights via AI chat, see cash vs miles prices side-by-side with cents-per-point (CPP) analysis and buy-miles pricing from PointsBazaar marketplace, rendered as rich widgets.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AI Chat Client                              │
│                  (ChatGPT, Claude, etc.)                            │
│                                                                     │
│  User: "Find flights from SFO to TPE in March"                     │
│                         │                                           │
│                         ▼                                           │
│              ┌─────────────────────┐                                │
│              │   MCP Tool Call     │                                │
│              │  search-flights     │                                │
│              └────────┬────────────┘                                │
└───────────────────────┼─────────────────────────────────────────────┘
                        │ JSON-RPC over HTTP
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      MCP Server (mcp-use)                           │
│                    http://localhost:3000/mcp                         │
│                                                                     │
│  ┌──────────────┐    ┌────────────────────────┐                     │
│  │  Tool Layer  │───▶│ UnifiedFlightSearch    │                     │
│  │  index.ts    │    │ Service                │                     │
│  └──────┬───────┘    └────────┬───────────────┘                     │
│         │                     │                                     │
│         │              ┌──────┴──────────────────────────┐          │
│         │              │      Promise.all([...])         │          │
│         │              │                                 │          │
│         │     ┌────────▼────┐ ┌──────▼──────┐ ┌─────────▼───────┐  │
│         │     │  Cash       │ │  Award      │ │  PointsBazaar   │  │
│         │     │  Provider   │ │  Provider   │ │  Provider       │  │
│         │     └──────┬──────┘ └──────┬──────┘ └────────┬────────┘  │
│         │            │               │                 │            │
│         │     ┌──────▼──────┐ ┌──────▼──────┐ ┌───────▼─────────┐  │
│         │     │ Browserbase │ │ Browserbase │ │ Firecrawl API   │  │
│         │     │ ephemeral   │ │ keepAlive   │ │ (no browser)    │  │
│         │     │ + proxies   │ │ + reconnect │ │                 │  │
│         │     └─────────────┘ └─────────────┘ └─────────────────┘  │
│         │                                                          │
│         ▼                                                          │
│  ┌──────────────┐                                                  │
│  │ Widget Layer │                                                  │
│  │ React UI     │                                                  │
│  │ (iframe)     │                                                  │
│  └──────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Request Flow

```
User Message
    │
    ▼
┌──────────────────┐
│  search-flights  │  MCP tool (index.ts)
│  tool handler    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│ UnifiedFlightSearchService                                   │
│                                                              │
│  1. Check cache (10-min TTL, keyed by search params)         │
│                                                              │
│  2. Promise.all([                                            │
│       cashProvider.search(params),        ← Browserbase      │
│       awardProvider.search(params),       ← Browserbase      │
│       pointsProvider.searchListings(),    ← Firecrawl        │
│     ])                                                       │
│     Award + Points fail gracefully (continue without data)   │
│                                                              │
│  3. Merge cash + award by flightNumber + departDate          │
│     (skip if cash flight already has milesPrice)             │
│                                                              │
│  4. Enrich each flight with CPP:                             │
│     cpp = (cashPrice − milesTaxes) / milesPrice × 100        │
│     rating = excellent | good | fair | poor                  │
│                                                              │
│  5. Compute buy-miles pricing:                               │
│     Find best marketplace rate for required miles            │
│     buyMilesTotal = milesPrice × bestRate                    │
│     buyMilesPlusTaxes = buyMilesTotal + milesTaxes           │
│                                                              │
│  6. Determine best deal:                                     │
│     cash vs redeem vs buy-miles                              │
│                                                              │
│  7. Cache result, return FlightSearchResult                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
yc-mcp-hack/
│
├── index.ts                          # MCP server entry — tool definitions
│
├── src/                              # Backend logic (server-side)
│   ├── schemas/
│   │   ├── flight.ts                 # Zod: FlightSearchParams, FlightResult, FlightSearchResult
│   │   └── points-listing.ts        # Zod: PointsListingSearchParams, PointsListingResult, PointsListingSearchResult
│   │
│   ├── utils/
│   │   └── cpp.ts                    # cents-per-point calculation + rating thresholds
│   │
│   ├── services/
│   │   ├── unified-flight-search-service.ts  # Orchestrator: parallel search → merge → buy-miles → CPP
│   │   └── points-listing-service.ts         # PointsBazaar standalone search + cache (5-min TTL)
│   │
│   └── providers/
│       ├── types.ts                  # FlightProvider + PointsListingProvider interfaces
│       ├── registry.ts               # Factory: DATA_MODE env → provider instances
│       │
│       ├── mock/
│       │   ├── provider.ts           # MockFlightProvider — returns fixture data
│       │   ├── data.ts               # ~12 realistic China Airlines SFO↔TPE flights
│       │   ├── points-provider.ts    # MockPointsListingProvider — fixture listings
│       │   └── points-data.ts        # Mock PointsBazaar marketplace listings
│       │
│       ├── china-airlines/
│       │   ├── provider.ts           # ChinaAirlinesProvider (cash) — delegates to lib/
│       │   ├── scraper.ts            # ScraperBackend interface (unused stubs)
│       │   └── scrapers/
│       │       ├── browserbase.ts    # Stub — not used (real scraping in lib/)
│       │       └── firecrawl.ts      # Stub — not used (real scraping in lib/)
│       │
│       ├── china-airlines-award/
│       │   └── provider.ts           # ChinaAirlinesAwardProvider — delegates to lib/
│       │
│       └── points-bazaar/
│           └── provider.ts           # PointsBazaarProvider — delegates to lib/
│
├── lib/                              # Standalone scraper modules
│   ├── china-airlines/               # Cash flight scraping (Browserbase + Playwright)
│   │   ├── index.ts                  # searchFlights() with retry logic
│   │   ├── types.ts                  # Zod: FlightSearchInput, FlightOption
│   │   ├── browser-session.ts        # Ephemeral Browserbase sessions, proxies: true
│   │   ├── search-form.ts            # Playwright form automation
│   │   ├── parse-results.ts          # Network interception + DOM fallback parsing
│   │   ├── config.ts                 # URLs, timeouts, CSS selectors
│   │   ├── errors.ts                 # SearchError with typed error codes
│   │   └── test-search.ts            # Standalone test script
│   │
│   ├── china-airlines-award/         # Award flight scraping (Browserbase + keepAlive)
│   │   ├── index.ts                  # searchAwardFlights() with retry logic
│   │   ├── login.ts                  # loginDynastyFlyer() — browser-based authentication
│   │   ├── types.ts                  # Zod: AwardSearchInput, AwardFlightOption
│   │   ├── browser-session.ts        # keepAlive sessions, reconnect via CDP
│   │   ├── search-form.ts            # Award search form automation
│   │   ├── parse-results.ts          # Award results parsing
│   │   ├── config.ts                 # URLs, timeouts
│   │   ├── errors.ts                 # AwardSearchError with typed codes
│   │   ├── test-login.ts             # Standalone login test
│   │   └── test-search.ts            # Standalone search test
│   │
│   └── points-bazaar/                # PointsBazaar marketplace scraping (Firecrawl)
│       ├── index.ts                  # searchListings() with retry logic
│       ├── firecrawl-client.ts       # Firecrawl API wrapper
│       ├── parse-results.ts          # Parse Firecrawl markdown → listings
│       ├── types.ts                  # Zod: ListingSearchInput, ListingSearchResult
│       ├── config.ts                 # URLs, extraction instructions
│       └── errors.ts                 # ListingSearchError with typed codes
│
├── resources/                        # Widget UI (client-side, rendered in iframe)
│   ├── styles.css                    # Global Tailwind + theme config
│   ├── flight-search-result/
│   │   ├── widget.tsx                # Main widget component
│   │   ├── types.ts                  # Widget prop Zod schemas
│   │   ├── components/
│   │   │   ├── FlightComparisonTable.tsx  # Table with sort + filter
│   │   │   ├── FlightRow.tsx              # Single flight row
│   │   │   ├── CppBadge.tsx               # Color-coded CPP indicator
│   │   │   ├── BestDealBadge.tsx          # Cash/redeem/buy deal indicator
│   │   │   ├── SavingsBreakdown.tsx       # Buy-miles savings detail
│   │   │   ├── SortHeader.tsx             # Clickable sortable column header
│   │   │   ├── EmptyState.tsx             # No results view
│   │   │   └── FlightTableSkeleton.tsx    # Loading skeleton
│   │   └── hooks/
│   │       ├── useFlightSort.ts      # Sort by price, CPP, date, etc.
│   │       └── useFlightFilter.ts    # Filter by stops, cabin class
│   │
│   └── points-listing-result/
│       ├── widget.tsx                # PointsBazaar listings widget
│       ├── types.ts                  # Widget prop Zod schemas
│       ├── components/
│       │   ├── ListingsTable.tsx     # Listings table with sort + filter
│       │   ├── ListingRow.tsx        # Single listing row
│       │   ├── RatingBadge.tsx       # Seller rating indicator
│       │   ├── SortHeader.tsx        # Sortable column header
│       │   ├── EmptyState.tsx        # No results view
│       │   └── ListingTableSkeleton.tsx  # Loading skeleton
│       └── hooks/
│           ├── useListingSort.ts     # Sort by price, miles, rating
│           └── useListingFilter.ts   # Filter listings
│
├── .mcp-use/                         # Auto-generated (do not edit)
│   └── tool-registry.d.ts           # TypeScript types for tool inputs/outputs
│
└── public/                           # Static assets served at /
```

---

## Layer Architecture

### Layer 1 — MCP Tools (`index.ts`)

Thin handlers that validate input and delegate to the service layer.

| Tool | Type | Description |
|------|------|-------------|
| `search-flights` | Widget tool | Unified search: cash + award + marketplace → comparison table |
| `get-flight-details` | Data tool | Return single flight by ID from cache |
| `search-points-listings` | Widget tool | Search PointsBazaar marketplace listings |
| `get-listing-details` | Data tool | Return single listing by ID from cache |
| `dynasty-flyer-login` | Action tool | Authenticate Dynasty Flyer for award searches |

### Layer 2 — Services (`src/services/`)

#### UnifiedFlightSearchService

Main orchestrator. Accepts 3 providers (cash, award, points) and runs the full pipeline:

```
Promise.all([
  cashProvider.search(params),
  awardProvider.search(params),           ← fails gracefully
  pointsProvider.searchListings({...}),   ← fails gracefully
])
    │
    ▼
mergeFlights(cash, award)                 ← match by flightNumber + departDate
    │
    ▼
enrichWithCpp(flight)                     ← compute CPP + rating
    │
    ▼
computeBuyMilesAndBestDeal(flight, listings)  ← find best marketplace rate
    │
    ▼
Cache result (10-min TTL) → return FlightSearchResult
```

#### PointsListingService

Standalone search for PointsBazaar listings. Provider → cache (5-min TTL) → return.

### Layer 3 — Providers (`src/providers/`)

Pluggable data sources behind `FlightProvider` and `PointsListingProvider` interfaces:

```typescript
interface FlightProvider {
  name: string;
  search(params: FlightSearchParams): Promise<FlightResult[]>;
}

interface PointsListingProvider {
  name: string;
  searchListings(params: PointsListingSearchParams): Promise<PointsListingResult[]>;
}
```

| Provider | Interface | Env Config | Description |
|----------|-----------|-----------|-------------|
| `MockFlightProvider` | `FlightProvider` | `DATA_MODE=mock` (default) | Static fixture data |
| `ChinaAirlinesProvider` | `FlightProvider` | `DATA_MODE=live` | Cash flights via Browserbase |
| `ChinaAirlinesAwardProvider` | `FlightProvider` | `DATA_MODE=live` | Award flights via Browserbase keepAlive |
| `MockPointsListingProvider` | `PointsListingProvider` | `DATA_MODE=mock` (default) | Static fixture listings |
| `PointsBazaarProvider` | `PointsListingProvider` | `DATA_MODE=live` | Marketplace via Firecrawl API |

Provider selection via `registry.ts` factory functions:
- `createProvider()` → cash flights (Mock or ChinaAirlines)
- `createAwardProvider()` → award flights (Mock or ChinaAirlinesAward)
- `createPointsListingProvider()` → marketplace (Mock or PointsBazaar)

### Layer 4 — Scrapers (`lib/`)

Three standalone modules, each with its own session strategy:

| Module | Technology | Session Strategy |
|--------|-----------|-----------------|
| `lib/china-airlines/` | Browserbase + Playwright | Ephemeral sessions, `proxies: true`, context persisted via `CHINA_AIRLINES_CONTEXT_ID` |
| `lib/china-airlines-award/` | Browserbase + Playwright | `keepAlive: true` (1hr timeout), reconnect via CDP using `DYNASTY_FLYER_SESSION_ID` |
| `lib/points-bazaar/` | Firecrawl API | Stateless HTTP calls, no browser needed |

All modules implement retry logic with exponential backoff and typed error codes.

Note: `src/providers/china-airlines/scrapers/` contains unused stubs. Real scraping lives in `lib/`.

### Layer 5 — Widgets (`resources/`)

React components rendered inside iframes by the MCP client:

| Widget | Tool | Description |
|--------|------|-------------|
| `flight-search-result` | `search-flights` | Flight comparison table with CPP, buy-miles, and deal analysis |
| `points-listing-result` | `search-points-listings` | PointsBazaar marketplace listings table |

---

## Session Architecture

### Cash Sessions (`lib/china-airlines/`)

- **Type**: Ephemeral Browserbase sessions
- **Proxies**: `proxies: true` (residential IP rotation)
- **Context**: Persisted via `CHINA_AIRLINES_CONTEXT_ID` for cookie reuse
- **Lifecycle**: Created per search, closed after scraping (page + browser closed, context synced)

### Award Sessions (`lib/china-airlines-award/`)

- **Type**: Long-lived Browserbase sessions with `keepAlive: true`
- **Timeout**: 1 hour (Browserbase `browserbaseSessionTimeout`)
- **Context**: Persisted via `DYNASTY_FLYER_CONTEXT_ID` for authenticated state
- **Reconnect**: Via CDP using `DYNASTY_FLYER_SESSION_ID` — reconnects to running session without re-auth
- **Login**: `dynasty-flyer-login` tool creates session, user completes email verification, session persists
- **Lifecycle**: Browser disconnected after search (session stays alive in Browserbase for reconnection)

### PointsBazaar Sessions (`lib/points-bazaar/`)

- **Type**: Stateless Firecrawl API calls
- **No browser**: Uses `@mendable/firecrawl-js` SDK to scrape marketplace pages
- **Auth**: `FIRECRAWL_API_KEY` for API access
- **Lifecycle**: Single HTTP request per search, no state to manage

---

## Data Model

```
FlightSearchParams                 FlightResult
┌─────────────────────┐           ┌──────────────────────────┐
│ origin:      "SFO"  │           │ id:            string    │
│ destination: "TPE"  │           │ airline:       string    │
│ departDate:  "..."  │──search──▶│ flightNumber:  string    │
│ returnDate?: "..."  │           │ origin/dest:   string    │
│ cabinClass?: enum   │           │ departDate:    string    │
│ passengers?: 1-9    │           │ departTime:    string    │
└─────────────────────┘           │ arriveTime:    string    │
                                  │ duration:      string    │
                                  │ stops:         number    │
                                  │ cabinClass:    string    │
                                  │ cashPrice:     number    │
FlightSearchResult                │ cashCurrency:  "USD"     │
┌─────────────────────┐           │ milesPrice:    ?number   │
│ flights: Result[]   │           │ milesTaxes:    ?number   │
│ searchParams: Params│           │ centsPerPoint: ?number ◀─┤── computed
│ provider: string    │           │ cppRating:     ?enum   ◀─┤── computed
│ timestamp: ISO      │           │ buyMilesRate:  ?number ◀─┤── from marketplace
└─────────────────────┘           │ buyMilesTotal: ?number ◀─┤── milesPrice × rate
                                  │ buyMilesPlusTaxes: ?num◀─┤── total + taxes
                                  │ bestDeal:      ?enum   ◀─┤── cash|redeem|buy
                                  │ savings:       ?number ◀─┤── cash − buyTotal
                                  └──────────────────────────┘

PointsListingSearchParams          PointsListingResult
┌─────────────────────┐           ┌──────────────────────────┐
│ airline?:    "CI"   │           │ id:              string  │
│ milesRange?: string │──search──▶│ airline:          string  │
│ unitPriceRange?: str│           │ loyaltyProgram?: string  │
└─────────────────────┘           │ milesAvailable:  number  │
                                  │ pricePerMile:    number  │
PointsListingSearchResult         │ totalPrice?:     number  │
┌─────────────────────┐           │ sellerDisplayName?: str  │
│ listings: Result[]  │           │ sellerRating?:   number  │
│ searchParams: Params│           │ listingStatus:   string  │
│ provider: string    │           │ postedDate?:     string  │
│ timestamp: ISO      │           └──────────────────────────┘
└─────────────────────┘
```

### CPP Calculation

```
cpp = (cashPrice − milesTaxes) / milesPrice × 100

┌───────────────┬────────────┬──────────┐
│ Rating        │ CPP Range  │ Color    │
├───────────────┼────────────┼──────────┤
│ ★★★★ Excellent│ ≥ 2.5      │ Green    │
│ ★★★  Good     │ ≥ 2.0      │ Blue     │
│ ★★   Fair     │ ≥ 1.5      │ Yellow   │
│ ★    Poor     │ < 1.5      │ Red      │
└───────────────┴────────────┴──────────┘
```

### Deal Analysis

For each flight with miles pricing, the system determines the best deal:

| Deal | Condition | Meaning |
|------|-----------|---------|
| `cash` | Default, or buyMilesPlusTaxes ≥ cashPrice | Pay cash — cheapest option |
| `redeem` | Has miles pricing but no marketplace rate available | Use your own miles |
| `buy` | buyMilesPlusTaxes < cashPrice | Buy miles on marketplace + redeem — cheapest |

`savings` = cashPrice − buyMilesPlusTaxes (only when bestDeal = "buy")

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MCP_URL` | No | `http://localhost:3000` | Server base URL |
| `DATA_MODE` | No | `mock` | `mock` or `live` — selects all providers |
| `BROWSERBASE_API_KEY` | Live only | — | Browserbase API key |
| `BROWSERBASE_PROJECT_ID` | Live only | — | Browserbase project ID |
| `CHINA_AIRLINES_CONTEXT_ID` | No | Auto-created | Persistent browser context for cash scraping |
| `DYNASTY_FLYER_CONTEXT_ID` | No | Auto-created | Persistent browser context for award sessions |
| `DYNASTY_FLYER_SESSION_ID` | No | Set after login | Reconnect to live award session |
| `FIRECRAWL_API_KEY` | Live only | — | Firecrawl API key for PointsBazaar scraping |

---

## Widget UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Flight Comparison                                              │
│  SFO → TPE                                                     │
│  12 flights found · Economy · 2026-03-15                        │
├─────────────────────────────────────────────────────────────────┤
│  Stops: [All] [Nonstop] [1 stop]                               │
├────────┬────────┬──────┬──────┬───────┬───────┬──────┬─────────┤
│ Date ▲ │ Flight │Route │Depart│ Cash  │ Miles │ CPP  │BestDeal │
├────────┼────────┼──────┼──────┼───────┼───────┼──────┼─────────┤
│ Mar 15 │ CI 005 │SFO→  │23:40 │ $850  │35,000 │⬤ 2.3│ 💰 Buy  │
│        │        │TPE   │13h40m│       │+$45   │★★★  │Save $120│
├────────┼────────┼──────┼──────┼───────┼───────┼──────┼─────────┤
│ Mar 17 │ CI 031 │SFO→  │11:30 │ $620  │25,000 │⬤ 2.3│ 💵 Cash │
│        │        │TPE   │18h45m│       │+$38   │★★★  │         │
├────────┼────────┼──────┼──────┼───────┼───────┼──────┼─────────┤
│  ...   │  ...   │ ...  │ ...  │ ...   │ ...   │ ...  │  ...    │
├────────┴────────┴──────┴──────┴───────┴───────┴──────┴─────────┤
│  CPP = cents per point · ★ Excellent ≥2.5  ★ Good ≥2.0         │
│                           ★ Fair ≥1.5      ★ Poor <1.5         │
└─────────────────────────────────────────────────────────────────┘
```

Row click → `sendFollowUpMessage()` triggers AI analysis of that flight.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server framework | mcp-use (Hono-based) |
| Protocol | MCP (Model Context Protocol) over JSON-RPC |
| Widget UI | React 19, Tailwind CSS v4, @openai/apps-sdk-ui |
| Validation | Zod v4 |
| Type system | TypeScript (strict) |
| Build | Vite 7 |
| Cash/Award scraping | Browserbase + Playwright |
| Marketplace scraping | Firecrawl (`@mendable/firecrawl-js`) |
| Dev tools | `http://localhost:3000/inspector` |
