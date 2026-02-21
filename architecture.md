# Architecture

Flight price/points comparison MCP server. Users search flights via AI chat, see cash vs miles prices side-by-side with cents-per-point (CPP) analysis rendered as a rich widget.

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
│  ┌──────────────┐    ┌────────────────────┐    ┌────────────────┐  │
│  │  Tool Layer  │───▶│   Service Layer    │───▶│ Provider Layer │  │
│  │  index.ts    │    │ flight-search-svc  │    │ mock / live    │  │
│  └──────┬───────┘    └────────────────────┘    └────────┬───────┘  │
│         │                                               │          │
│         ▼                                               ▼          │
│  ┌──────────────┐                              ┌────────────────┐  │
│  │ Widget Layer │                              │ Scraper Layer  │  │
│  │ React UI     │                              │ Browserbase /  │  │
│  │ (iframe)     │                              │ Playwright     │  │
│  └──────────────┘                              └────────────────┘  │
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
┌──────────────────┐
│ FlightSearch     │  Orchestration (src/services/)
│ Service          │
│                  │
│  • check cache   │
│  • call provider │
│  • compute CPP   │
│  • assign rating │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌─────────────────────┐
│ Provider         │     │ Provider             │
│ Registry         │────▶│ (selected by env)    │
│                  │     │                      │
│ DATA_MODE=mock   │     │ MockFlightProvider   │
│ DATA_MODE=live   │     │ ChinaAirlinesProvider│
└──────────────────┘     └──────────┬───────────┘
                                    │
                         ┌──────────┴───────────┐
                         │                      │
                    ┌────▼─────┐          ┌─────▼────┐
                    │ Mock     │          │ Live     │
                    │ data.ts  │          │ Scraper  │
                    │ (static) │          │ Layer    │
                    └──────────┘          └──────────┘
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
│   │   └── flight.ts                 # Zod schemas: FlightSearchParams, FlightResult, FlightSearchResult
│   │
│   ├── utils/
│   │   └── cpp.ts                    # cents-per-point calculation + rating thresholds
│   │
│   ├── services/
│   │   └── flight-search-service.ts  # Orchestration: provider → CPP enrichment → cache
│   │
│   └── providers/
│       ├── types.ts                  # FlightProvider interface
│       ├── registry.ts               # Factory: DATA_MODE env → provider instance
│       │
│       ├── mock/
│       │   ├── provider.ts           # MockFlightProvider — returns fixture data
│       │   └── data.ts               # ~12 realistic China Airlines SFO↔TPE flights
│       │
│       └── china-airlines/
│           ├── provider.ts           # ChinaAirlinesProvider — uses ScraperBackend
│           ├── scraper.ts            # ScraperBackend interface + factory
│           └── scrapers/
│               ├── browserbase.ts    # Stub — BrowserBase implementation
│               └── firecrawl.ts      # Stub — Firecrawl implementation
│
├── lib/                              # Standalone scraper module (Browserbase + Playwright)
│   └── china-airlines/
│       ├── index.ts                  # searchFlights() with retry logic
│       ├── types.ts                  # Zod schemas: FlightSearchInput, FlightOption
│       ├── browser-session.ts        # Browserbase cloud browser session management
│       ├── search-form.ts            # Playwright form automation
│       ├── parse-results.ts          # Network interception + DOM fallback parsing
│       ├── config.ts                 # URLs, timeouts, CSS selectors
│       ├── errors.ts                 # SearchError with typed error codes
│       └── test-search.ts            # Standalone test script
│
├── resources/                        # Widget UI (client-side, rendered in iframe)
│   ├── styles.css                    # Global Tailwind + theme config
│   └── flight-search-result/
│       ├── widget.tsx                # Main widget component
│       ├── types.ts                  # Widget prop Zod schemas
│       ├── components/
│       │   ├── FlightComparisonTable.tsx  # Table with sort + filter
│       │   ├── FlightRow.tsx              # Single flight row
│       │   ├── CppBadge.tsx               # Color-coded CPP indicator
│       │   ├── SortHeader.tsx             # Clickable sortable column header
│       │   ├── EmptyState.tsx             # No results view
│       │   └── FlightTableSkeleton.tsx    # Loading skeleton
│       └── hooks/
│           ├── useFlightSort.ts      # Sort by price, CPP, date, etc.
│           └── useFlightFilter.ts    # Filter by stops, cabin class
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
| `search-flights` | Widget tool | Search + render comparison table |
| `get-flight-details` | Data tool | Return single flight details by ID |

### Layer 2 — Service (`src/services/flight-search-service.ts`)

Orchestrates the full search flow:

```
Provider.search(params)
    │
    ▼
Raw FlightResult[]
    │
    ▼
Enrich each flight:
    cpp = (cashPrice - milesTaxes) / milesPrice × 100
    rating = excellent (≥2.5) | good (≥2.0) | fair (≥1.5) | poor (<1.5)
    │
    ▼
Cache result (10-min TTL, keyed by search params)
    │
    ▼
Return FlightSearchResult
```

### Layer 3 — Providers (`src/providers/`)

Pluggable data sources behind the `FlightProvider` interface:

```typescript
interface FlightProvider {
  name: string;
  search(params: FlightSearchParams): Promise<FlightResult[]>;
}
```

| Provider | Env Config | Status |
|----------|-----------|--------|
| `MockFlightProvider` | `DATA_MODE=mock` (default) | Working |
| `ChinaAirlinesProvider` | `DATA_MODE=live` | Stub (delegates to scraper) |

### Layer 4 — Scraper (`lib/china-airlines/`)

Standalone Browserbase + Playwright module for live data:

```
searchFlights(input)
    │
    ▼
BrowserSessionManager.createSession()    ← Browserbase cloud Chrome
    │
    ▼
fillAndSubmitSearchForm(page, input)     ← Playwright automation
    │
    ▼
parseFlightResults(page, interceptor)    ← Network interception or DOM scraping
    │
    ▼
FlightSearchResult
```

### Layer 5 — Widget (`resources/flight-search-result/`)

React component rendered inside an iframe by the MCP client:

```
widget.tsx
    │
    ├── useWidget<Props>()           ← receives FlightSearchResult from tool
    ├── useCallTool("get-flight-details")  ← drill-down on row click
    ├── sendFollowUpMessage()        ← ask AI about selected flight
    │
    └── FlightComparisonTable
            ├── useFlightFilter()    ← filter by stops
            ├── useFlightSort()      ← sort by column
            │
            ├── SortHeader ×8        ← clickable column headers
            └── FlightRow ×n         ← one per flight
                 └── CppBadge       ← color-coded value rating
```

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
FlightSearchResult                │ cashPrice:     number    │
┌─────────────────────┐           │ cashCurrency:  "USD"     │
│ flights: Result[]   │           │ milesPrice:    ?number   │
│ searchParams: Params│           │ milesTaxes:    ?number   │
│ provider: string    │           │ centsPerPoint: ?number ◀─┤── computed
│ timestamp: ISO      │           │ cppRating:     ?enum   ◀─┤── computed
└─────────────────────┘           └──────────────────────────┘
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

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MCP_URL` | No | `http://localhost:3000` | Server base URL |
| `DATA_MODE` | No | `mock` | `mock` or `live` |
| `SCRAPER_BACKEND` | No | `browserbase` | `browserbase` or `firecrawl` |
| `BROWSERBASE_API_KEY` | Live only | — | Browserbase API key |
| `BROWSERBASE_PROJECT_ID` | Live only | — | Browserbase project ID |
| `CHINA_AIRLINES_CONTEXT_ID` | No | Auto-created | Persistent browser context |

---

## Widget UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Flight Comparison                                              │
│  SFO → TPE                                                     │
│  12 flights found · Economy · 2026-03-15                        │
├─────────────────────────────────────────────────────────────────┤
│  Stops: [All] [Nonstop] [1 stop]                               │
├────────┬────────┬──────────┬────────┬───────┬───────┬────┬──────┤
│ Date ▲ │ Flight │ Route    │ Depart │ Cash  │ Miles │Tax │ CPP  │
├────────┼────────┼──────────┼────────┼───────┼───────┼────┼──────┤
│ Mar 15 │ CI 005 │ SFO→TPE  │ 23:40  │ $850  │35,000 │$45 │⬤ 2.3│
│        │        │          │ 13h40m │       │       │    │★★★  │
│        │        │          │nonstop │       │       │    │     │
├────────┼────────┼──────────┼────────┼───────┼───────┼────┼──────┤
│ Mar 17 │ CI 031 │ SFO→TPE  │ 11:30  │ $620  │25,000 │$38 │⬤ 2.3│
│        │        │          │ 18h45m │       │       │    │★★★  │
│        │        │          │ 1 stop │       │       │    │     │
├────────┼────────┼──────────┼────────┼───────┼───────┼────┼──────┤
│  ...   │  ...   │   ...    │  ...   │ ...   │ ...   │... │ ...  │
├────────┴────────┴──────────┴────────┴───────┴───────┴────┴──────┤
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
| Live scraping | Browserbase + Playwright |
| Dev tools | `http://localhost:3000/inspector` |
