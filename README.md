# FlightMCP — Airline Flight Search & Points Value Comparison

An MCP server that searches airline flights across cash and award (miles) pricing, calculates cents-per-point (CPP) value, and surfaces deals from the PointsBazaar P2P miles marketplace. Built with [mcp-use](https://mcp-use.com) and designed to run inside MCP clients like ChatGPT.

## Deployed URLs

- **MCP Server:** https://throbbing-sound-b8zey.run.mcp-use.com/mcp
- **Inspector:** [Open Inspector](https://inspector.manufact.com/inspector?autoConnect=https%3A%2F%2Fthrobbing-sound-b8zey.run.mcp-use.com%2Fmcp)

## What It Does

- **Unified flight search** — Searches China Airlines for both cash fares and Dynasty Flyer award availability in a single query
- **CPP analysis** — Compares cash price vs. miles redemption to show you the cents-per-point value of each booking option
- **Miles marketplace** — Searches PointsBazaar for third-party miles listings so you can find cheaper points to book award flights
- **Rich UI widgets** — Returns interactive React tables with sorting, filtering, and detailed breakdowns directly in the chat

## Tools

| Tool | Description |
|------|-------------|
| `search-flights` | Search flights with side-by-side cash vs. miles pricing and CPP analysis |
| `get-flight-details` | Get detailed info for a specific flight |
| `search-points-listings` | Search PointsBazaar marketplace for airline miles deals |
| `get-listing-details` | Get details for a specific marketplace listing |
| `dynasty-flyer-login` | Authenticate with China Airlines Dynasty Flyer (persists across sessions) |

## Getting Started

```bash
npm install
npm run dev
```

- `http://localhost:3000/mcp` — MCP protocol endpoint
- `http://localhost:3000/inspector` — Interactive testing UI

### Environment Variables

| Variable | Description |
|----------|-------------|
| `BROWSERBASE_API_KEY` | Browserbase API key for browser automation |
| `BROWSERBASE_PROJECT_ID` | Browserbase project ID |
| `FIRECRAWL_API_KEY` | Firecrawl API key for PointsBazaar scraping |

## Architecture

```
index.ts                  → MCP server entry, tool registration
src/services/             → Search orchestration & caching
lib/china-airlines/       → Cash flight search (Playwright + Browserbase)
lib/china-airlines-award/ → Award search via Dynasty Flyer
lib/points-bazaar/        → PointsBazaar marketplace scraping (Firecrawl)
resources/                → React widgets (flight results, points listings)
```

Flight searches use Browserbase for managed browser sessions with residential proxies, intercepting airline API responses for reliable data extraction.

## Stack

mcp-use, React 19, TypeScript, Playwright, Browserbase, Firecrawl, Tailwind CSS v4, Zod

## Deploy

```bash
npm run deploy
```
