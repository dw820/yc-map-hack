# China Airlines Award Flight Search

Authenticated scraper for **Dynasty Flyer** mileage/award flight searches on China Airlines. Unlike the cash flight module (`lib/china-airlines/`), this requires a logged-in session because award availability is only visible to Dynasty Flyer members.

---

## How It Works

Uses Browserbase **long-running sessions** (`keepAlive: true`) to persist auth. After login, the Browserbase session stays alive (up to 1 hour) with live cookies in the browser. Search reconnects to the same session via CDP — no context-based cookie persistence needed.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FIRST-TIME LOGIN                            │
│                                                                    │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────────────┐     │
│  │ MCP Tool │───▶│ Browserbase   │───▶│ Dynasty Flyer Login  │     │
│  │ dynasty- │    │ Cloud Browser │    │ Page (email verify)  │     │
│  │ flyer-   │    │ keepAlive:true│    │                      │     │
│  │ login    │    │ timeout:3600s │    │ User completes login │     │
│  └──────────┘    │ Debug URL ◀───┼────│ manually via debug   │     │
│       │          └───────┬───────┘    │ URL                  │     │
│       │                  │            └──────────────────────┘     │
│       │                  ▼                                         │
│       │          ┌───────────────┐                                 │
│       │          │ Polls every   │                                 │
│       └─────────▶│ 5s for up to  │──── Login confirmed ─────┐     │
│                  │ 5 minutes     │                           │     │
│                  └───────────────┘                           │     │
│                                                             ▼     │
│                  ┌───────────────┐              ┌────────────────┐ │
│                  │ Disconnect    │◀─────────────│ SESSION_ID     │ │
│                  │ Playwright    │              │ (saved to .env │ │
│                  │ (session      │              │  for reconnect)│ │
│                  │  stays alive) │              └────────────────┘ │
│                  └───────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      AWARD FLIGHT SEARCH                           │
│                                                                    │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────────────┐     │
│  │ MCP Tool │───▶│ Reconnect to  │───▶│ dynasty-flyer.com    │     │
│  │ search-  │    │ same session  │    │ /member/dashboard    │     │
│  │ award-   │    │ via SESSION_ID│    │ (live cookies — no   │     │
│  │ flights  │    │ (CDP connect) │    │  login redirect!)    │     │
│  └──────────┘    └───────────────┘    └──────────┬───────────┘     │
│                                                  │                 │
│                                       ┌──────────▼───────────┐     │
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
│   ┌──────────────────────┐    ┌───────────────┐                    │
│   │ AwardFlightOption[]  │    │ Disconnect    │                    │
│   │                      │    │ (session stays│                    │
│   │ • milesPrice         │    │  alive for    │                    │
│   │ • taxesAndFees       │    │  more searches│                    │
│   │ • seatAvailability   │    │  up to 1 hr)  │                    │
│   │ • bookingClass       │    └───────────────┘                    │
│   │ • segments           │                                         │
│   └──────────────────────┘                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Session Lifecycle

```
Login                Search 1             Search 2             Timeout
  │                    │                    │                    │
  ▼                    ▼                    ▼                    ▼
CREATE session ──── RECONNECT ─────── RECONNECT ─────── session expires
(keepAlive:true)   (CDP connect)     (CDP connect)      (after 1 hour)
  │                    │                    │
  ├─ user logs in      ├─ navigate          ├─ navigate
  ├─ DISCONNECT        ├─ fill form         ├─ fill form
  │  (session alive)   ├─ get results       ├─ get results
  │                    ├─ DISCONNECT        ├─ DISCONNECT
  │                    │  (session alive)   │  (session alive)
  ▼                    ▼                    ▼
```

Key points:
- `close()` only disconnects the Playwright CDP connection — no `page.close()`, so browser tabs and cookies stay alive
- Sessions survive up to `browserbaseSessionTimeout` (default 1 hour, max 6 hours)
- Multiple searches can reuse the same session without re-authenticating
- If session expires, `reconnectToSession()` throws `AUTH_REQUIRED` prompting re-login

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
│                            keepAlive sessions, reconnect, disconnect, release
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
 (keepAlive: true)                              │
        │                                       ▼
        ▼                              Reconnect to session
 Navigate to login URL                 (manager.reconnectToSession)
        │                                       │
        ▼                                       ▼
 pollForLoginCompletion()              createNetworkInterceptor()
 (5s interval, 5min max)                        │
        │                                       ▼
        ▼                              navigateToAwardPage()
 Disconnect Playwright                 (dashboard → award link → new tab?)
 (session stays alive)                          │
        │                                       ▼
        ▼                              fillAndSubmitAwardSearchForm()
 Return LoginResult                             │
 { sessionId, contextId }                       ▼
                                       parseAwardResults()
                                       ├── API JSON found? ──▶ parse structured data
                                       └── no API data? ──▶ DOM regex fallback
                                                │
                                                ▼
                                       Disconnect (session stays alive)
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
| Session persistence | Ephemeral sessions | Long-running keepAlive sessions |
| Key env var | `CHINA_AIRLINES_CONTEXT_ID` | `DYNASTY_FLYER_SESSION_ID` |
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

# Session ID from dynasty-flyer-login — search reconnects to this live session
DYNASTY_FLYER_SESSION_ID=session_xxxxxxxx

# Context ID (optional) — used when creating new sessions
DYNASTY_FLYER_CONTEXT_ID=ctx_xxxxxxxx
```

---

## Usage via MCP Tools

**Step 1 — Login (once per hour):**
Call the `dynasty-flyer-login` tool. It opens a Browserbase session with `keepAlive: true` and returns a debug URL. Complete login via the debug URL (email verification required). After login, Playwright disconnects but the session stays alive with live cookies. The session ID is stored for reconnection.

**Step 2 — Search (reuses live session):**
Call `search-award-flights` with origin, destination, and date. It reconnects to the live Browserbase session — the browser still has authenticated cookies, so no login redirect occurs. After search, Playwright disconnects again (session stays alive for more searches).

**Session expiry:**
Sessions last up to 1 hour (configurable via `browserbaseSessionTimeout`). If a session expires, search throws `AUTH_REQUIRED` and the user must re-login.

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
