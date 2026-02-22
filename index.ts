import { MCPServer, error, object, text, widget } from "mcp-use/server";
import { flightSearchParamsSchema } from "./src/schemas/flight.js";
import { pointsListingSearchParamsSchema } from "./src/schemas/points-listing.js";
import { createProvider, createPointsListingProvider, createAwardProvider } from "./src/providers/registry.js";
import { UnifiedFlightSearchService } from "./src/services/unified-flight-search-service.js";
import { PointsListingService } from "./src/services/points-listing-service.js";
import { loginDynastyFlyer } from "./lib/china-airlines-award/index.js";
import { z } from "zod";

const server = new MCPServer({
  name: "yc-mcp-hack",
  title: "Flight Price Comparison",
  version: "1.0.0",
  description:
    "Compare airline ticket prices: cash vs miles/points with cents-per-point analysis",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
  favicon: "favicon.ico",
  websiteUrl: "https://mcp-use.com",
  icons: [
    {
      src: "icon.svg",
      mimeType: "image/svg+xml",
      sizes: ["512x512"],
    },
  ],
});

const provider = createProvider();
const awardProvider = createAwardProvider();
const pointsProvider = createPointsListingProvider();

const unifiedService = new UnifiedFlightSearchService(provider, awardProvider, pointsProvider);
const pointsService = new PointsListingService(pointsProvider);

server.tool(
  {
    name: "search-flights",
    description:
      "Search for flights and compare cash prices vs miles/points with cents-per-point (CPP) value analysis. Returns a visual comparison table.",
    schema: flightSearchParamsSchema,
    widget: {
      name: "flight-search-result",
      invoking: "Searching flights...",
      invoked: "Results loaded",
    },
  },
  async (params, ctx) => {
    let step = 0;
    const progressInterval = setInterval(async () => {
      step++;
      await ctx.reportProgress?.(step, 0, "Searching flights...");
    }, 5_000);

    try {
      const result = await unifiedService.search(params);
      clearInterval(progressInterval);

      return widget({
        props: result,
        output: text(
          `Found ${result.flights.length} flights from ${params.origin} to ${params.destination} on ${params.departDate} — comparing cash, miles, and buy-miles pricing (provider: ${result.provider})`
        ),
      });
    } catch (err) {
      clearInterval(progressInterval);
      console.error("Flight search failed:", err);
      return error(
        `Flight search failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }
);

server.tool(
  {
    name: "get-flight-details",
    description: "Get detailed information about a specific flight by ID",
    schema: z.object({
      flightId: z.string().describe("The flight ID from search results"),
    }),
    annotations: {
      readOnlyHint: true,
    },
  },
  async ({ flightId }) => {
    const flight = unifiedService.getFlightById(flightId);

    if (!flight) {
      return error(
        `Flight not found: ${flightId}. Try searching for flights first.`
      );
    }

    return object(flight);
  }
);

server.tool(
  {
    name: "search-points-listings",
    description:
      "Search the PointsBazaar P2P marketplace for airline miles listings. Shows available miles for purchase with price per mile, seller ratings, and total cost. Use this to help users find the best deals on buying airline miles.",
    schema: pointsListingSearchParamsSchema,
    widget: {
      name: "points-listing-result",
      invoking: "Searching PointsBazaar...",
      invoked: "Listings loaded",
    },
  },
  async (params) => {
    try {
      const result = await pointsService.search(params);

      const airlineLabel = params.airline || "all airlines";
      return widget({
        props: result,
        output: text(
          `Found ${result.listings.length} listings for ${airlineLabel} on PointsBazaar (provider: ${result.provider})`
        ),
      });
    } catch (err) {
      console.error("Points listing search failed:", err);
      return error(
        `Points listing search failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }
);

server.tool(
  {
    name: "get-listing-details",
    description:
      "Get detailed information about a specific PointsBazaar listing by ID",
    schema: z.object({
      listingId: z
        .string()
        .describe("The listing ID from search results"),
    }),
    annotations: {
      readOnlyHint: true,
    },
  },
  async ({ listingId }) => {
    const listing = pointsService.getListingById(listingId);

    if (!listing) {
      return error(
        `Listing not found: ${listingId}. Try searching for listings first.`
      );
    }

    return object(listing);
  }
);

server.tool(
  {
    name: "dynasty-flyer-login",
    description:
      "Log in to Dynasty Flyer (China Airlines loyalty program) to enable award flight searches. Opens a browser session for you to complete login with email verification. Run this once — the session persists across searches.",
    schema: z.object({}),
  },
  async () => {
    try {
      const result = await loginDynastyFlyer();

      if (result.success) {
        return text(
          `Login successful!\n\n` +
            `Debug URL: ${result.debugUrl}\n` +
            `Context ID: ${result.contextId}\n\n` +
            `To persist this session, set DYNASTY_FLYER_CONTEXT_ID=${result.contextId} in your .env file.\n\n` +
            `Award flight data will now be included in search-flights results.`
        );
      }

      return error(`Dynasty Flyer login failed: ${result.message}`);
    } catch (err) {
      console.error("Dynasty Flyer login failed:", err);
      return error(
        `Dynasty Flyer login failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }
);

server.listen().then(() => {
  console.log("Server running");
});
