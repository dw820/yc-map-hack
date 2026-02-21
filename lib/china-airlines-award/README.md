# China Airlines Award Flight Search

Authenticated scraper for **Dynasty Flyer** mileage/award flight searches on China Airlines. Unlike the cash flight module (`lib/china-airlines/`), this requires a logged-in session because award availability is only visible to Dynasty Flyer members.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FIRST-TIME LOGIN                            │
│                                                                    │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────────────┐     │
│  │ MCP Tool │───▶│ Browserbase   │───▶│ Dynasty Flyer Login  │     │
│  │ dynasty- │    │ Cloud Browser │    │ Page (email verify)  │     │
│  │ flyer-   │    │               │    │                      │     │
│  │ login    │    │ Debug URL ◀───┼────│ User completes login │     │
│  └──────────┘    │ (live view)   │    │ manually via debug   │     │
│       │          └───────┬───────┘    │ URL                  │     │
│       │                  │            └──────────────────────┘     │
│       │                  ▼                                         │
│       │          ┌───────────────┐                                 │
│       │          │ Polls every   │                                 │
│       └─────────▶│ 5s for up to  │──── Auth cookies saved ────┐    │
│                  │ 5 minutes     │    in Browserbase context   │    │
│                  └───────────────┘                             │    │
│                                                               ▼    │
│                                                  ┌────────────────┐│
│                                                  │ CONTEXT_ID     ││
│                                                  │ (persisted in  ││
│                                                  │  .env file)    ││
│                                                  └────────────────┘│
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      AWARD FLIGHT SEARCH                           │
│                                                                    │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────────────┐     │
│  │ MCP Tool │───▶│ Browserbase   │───▶│ china-airlines.com   │     │
│  │ search-  │    │ (reuses       │    │ (already logged in   │     │
│  │ award-   │    │  CONTEXT_ID   │    │  via saved cookies)  │     │
│  │ flights  │    │  with auth    │    └──────────┬───────────┘     │
│  └──────────┘    │  cookies)     │               │                 │
│                  └───────────────┘               ▼                 │
│                                       ┌──────────────────────┐     │
│                                       │ Navigate to Award    │     │
│   ┌──────────────────────┐            │ Ticket page via      │     │
│   │ Parse Results        │◀───────────│ member menu          │     │
│   │                      │            │ (handles new tab)    │     │
│   │ 1. API interception  │            └──────────┬───────────┘     │
│   │    (JSON responses)  │                       │                 │
│   │                      │            ┌──────────▼───────────┐     │
│   │ 2. DOM fallback      │◀───────────│ Fill & submit award  │     │
│   │    (regex scraping)  │            │ search form          │     │
│   └──────────┬───────────┘            │ (origin, dest, date) │     │
│              │                        └──────────────────────┘     │
│              ▼                                                     │
│   ┌──────────────────────┐                                         │
│   │ AwardFlightOption[]  │                                         │
│   │                      │                                         │
│   │ • milesPrice         │                                         │
│   │ • taxesAndFees       │                                         │
│   │ • seatAvailability   │                                         │
│   │ • bookingClass       │                                         │
│   │ • segments           │                                         │
│   └──────────────────────┘                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Module Structure

```
lib/china-airlines-award/
│
├── index.ts              ← Public API (loginDynastyFlyer, searchAwardFlights)
│                            Orchestrates the full flow with retry logic
│
├── login.ts              ← Login flow
│                            startLoginSession → pollForLoginCompletion → checkAuthStatus
│
├── search-form.ts        ← Award page navigation + form filling
│                            navigateToAwardPage → fillAndSubmitAwardSearchForm
│
├── parse-results.ts      ← Result extraction
│                            Network interception (JSON APIs) + DOM fallback (regex)
│
├── browser-session.ts    ← Browserbase session manager (singleton)
│                            Separate context from cash module (DYNASTY_FLYER_CONTEXT_ID)
│
├── config.ts             ← URLs, timeouts, CSS selectors, API patterns
│
├── types.ts              ← Zod schemas (AwardSearchInput, AwardFlightOption, etc.)
│
└── errors.ts             ← Error types (AUTH_REQUIRED, LOGIN_TIMEOUT, etc.)
```

### Data Flow

```
loginDynastyFlyer()                    searchAwardFlights(input)
        │                                       │
        ▼                                       ▼
 startLoginSession()                   Validate input (Zod)
        │                                       │
        ▼                                       ▼
 Navigate to login URL                 Create browser session
        │                              (reuses auth context)
        ▼                                       │
 pollForLoginCompletion()                       ▼
 (5s interval, 5min max)              checkAuthStatus()
        │                              ├── authenticated? ──▶ continue
        ▼                              └── not auth? ──▶ throw AUTH_REQUIRED
 checkAuthStatus()                              │
        │                                       ▼
        ▼                              createNetworkInterceptor()
 Close session                                  │
 (cookies persist)                              ▼
        │                              navigateToAwardPage()
        ▼                              (member menu → award link → new tab?)
 Return LoginResult                             │
 { contextId, debugUrl }                        ▼
                                       fillAndSubmitAwardSearchForm()
                                                │
                                                ▼
                                       parseAwardResults()
                                       ├── API JSON found? ──▶ parse structured data
                                       └── no API data? ──▶ DOM regex fallback
                                                │
                                                ▼
                                       Return AwardSearchResult
                                       { outbound: AwardFlightOption[] }
```

---

## Key Differences from Cash Module

| Aspect | Cash (`lib/china-airlines/`) | Award (`lib/china-airlines-award/`) |
|--------|------------------------------|--------------------------------------|
| Auth required | No | Yes (Dynasty Flyer login) |
| Browser context env var | `CHINA_AIRLINES_CONTEXT_ID` | `DYNASTY_FLYER_CONTEXT_ID` |
| Target site | `china-airlines.com` booking | `membersonair.china-airlines.com` |
| Login polling | N/A | 5 min timeout, 5s interval |
| Price data | Cash (USD/TWD) | Miles + taxes/fees |
| Extra data | — | Seat availability, booking class |
| Non-retryable errors | `INVALID_INPUT`, `CAPTCHA` | `INVALID_INPUT`, `AUTH_REQUIRED`, `AUTH_EXPIRED` |

---

## Environment Variables

```bash
# Required (shared with cash module)
BROWSERBASE_API_KEY=your-api-key
BROWSERBASE_PROJECT_ID=your-project-id

# Created by dynasty-flyer-login, set in .env to persist
DYNASTY_FLYER_CONTEXT_ID=ctx_xxxxxxxx
```

---

## Usage via MCP Tools

**Step 1 — Login (once):**
Call the `dynasty-flyer-login` tool. It opens a Browserbase session and returns a debug URL. Complete login via the debug URL (email verification required). The tool polls for completion and saves cookies in a persistent context.

**Step 2 — Search:**
Call `search-award-flights` with origin, destination, and date. It reuses the authenticated context to search for award availability.

---

## Debug Artifacts

After each search, these files are written to `lib/china-airlines-award/`:

| File | Contents |
|------|----------|
| `debug-award-results.png` | Full-page screenshot of results |
| `debug-award-results.html` | Raw HTML of results page |
| `debug-api-responses.json` | All intercepted API responses |

Use Browserbase session replay for step-by-step debugging:
`https://browserbase.com/sessions/{sessionId}`
