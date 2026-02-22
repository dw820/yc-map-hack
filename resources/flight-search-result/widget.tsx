import { AppsSDKUIProvider } from "@openai/apps-sdk-ui/components/AppsSDKUIProvider";
import {
  McpUseProvider,
  useCallTool,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import "../styles.css";
import { FlightComparisonTable } from "./components/FlightComparisonTable";
import { FlightTableSkeleton } from "./components/FlightTableSkeleton";
import { LiveBrowserView } from "./components/LiveBrowserView";
import type { FlightSearchResultProps, FlightResult } from "./types";
import { propSchema } from "./types";

export const widgetMetadata: WidgetMetadata = {
  description:
    "Display unified flight search results comparing cash, miles redemption, and buy-miles pricing with best deal analysis",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Searching flights...",
    invoked: "Results loaded",
    csp: {
      "frame-src": ["https://*.browserbase.com"],
    },
  },
};

interface BrowserUrls {
  cashBrowserUrl: string | null;
  awardBrowserUrl: string | null;
}

const FlightSearchResultWidget: React.FC = () => {
  const { props, isPending, sendFollowUpMessage } =
    useWidget<FlightSearchResultProps>();

  const { callToolAsync } = useCallTool("get-search-progress");
  const [browserUrls, setBrowserUrls] = useState<BrowserUrls>({
    cashBrowserUrl: null,
    awardBrowserUrl: null,
  });
  const pollingRef = useRef(false);

  useEffect(() => {
    if (!isPending) {
      pollingRef.current = false;
      setBrowserUrls({ cashBrowserUrl: null, awardBrowserUrl: null });
      return;
    }

    if (pollingRef.current) return;
    pollingRef.current = true;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;

      try {
        const result = await callToolAsync({});
        if (cancelled) return;

        const data = result?.structuredContent as BrowserUrls | undefined;
        if (data) {
          setBrowserUrls(data);
        }
      } catch {
        // Tool call failed — keep trying
      }

      if (!cancelled) {
        setTimeout(poll, 3000);
      }
    };

    // Initial delay before first poll
    const timer = setTimeout(poll, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isPending, callToolAsync]);

  if (isPending) {
    const hasUrls = browserUrls.cashBrowserUrl || browserUrls.awardBrowserUrl;

    return (
      <McpUseProvider>
        <div className="relative bg-surface-elevated border border-default rounded-3xl">
          <div className="p-6 pb-3">
            <h5 className="text-secondary mb-1 text-sm">Flight Comparison</h5>
            <h2 className="heading-xl mb-2">
              {hasUrls ? "Searching flights..." : "Flight Price Comparison"}
            </h2>
            {hasUrls && (
              <p className="text-sm text-secondary mb-1">
                Watch the browsers search in real time
              </p>
            )}
            {!hasUrls && (
              <div className="h-4 w-56 rounded-md bg-default/10 animate-pulse" />
            )}
          </div>
          <div className="px-6 pb-6">
            {hasUrls ? (
              <LiveBrowserView
                cashUrl={browserUrls.cashBrowserUrl}
                awardUrl={browserUrls.awardBrowserUrl}
              />
            ) : (
              <FlightTableSkeleton />
            )}
          </div>
        </div>
      </McpUseProvider>
    );
  }

  const { flights, searchParams } = props;
  const cabinLabel = searchParams.cabinClass
    ? searchParams.cabinClass.replace("_", " ")
    : "economy";

  const handleSelectFlight = (flight: FlightResult) => {
    const parts = [
      `Tell me more about flight ${flight.flightNumber} on ${flight.departDate} from ${flight.origin} to ${flight.destination}.`,
      `Cash price is $${flight.cashPrice}.`,
    ];

    if (flight.milesPrice) {
      parts.push(
        `Miles: ${flight.milesPrice.toLocaleString()} mi + $${flight.milesTaxes} taxes (${flight.centsPerPoint?.toFixed(1)} cpp).`
      );
    }

    if (flight.buyMilesPlusTaxes != null) {
      parts.push(
        `Buy miles & redeem: $${flight.buyMilesPlusTaxes} (rate: $${flight.buyMilesRate}/mi from marketplace).`
      );
    }

    if (flight.bestDeal === "buy" && flight.savings != null) {
      parts.push(`Best deal is buying miles — saves $${flight.savings}.`);
    }

    parts.push("Is this a good deal?");
    sendFollowUpMessage(parts.join(" "));
  };

  return (
    <McpUseProvider>
      <AppsSDKUIProvider linkComponent={Link}>
        <div className="relative bg-surface-elevated border border-default rounded-3xl">
          {/* Header */}
          <div className="p-6 pb-3">
            <h5 className="text-secondary mb-1 text-sm">Flight Comparison</h5>
            <h2 className="heading-xl mb-1">
              {searchParams.origin} &#8594; {searchParams.destination}
            </h2>
            <p className="text-sm text-secondary">
              {flights.length} flights found &middot;{" "}
              <span className="capitalize">{cabinLabel}</span> &middot;{" "}
              {searchParams.departDate}
              {searchParams.returnDate && ` \u2014 ${searchParams.returnDate}`}
            </p>
          </div>

          {/* Comparison Table */}
          <div className="px-2 pb-4">
            <FlightComparisonTable
              flights={flights}
              onSelectFlight={handleSelectFlight}
            />
          </div>

          {/* Legend */}
          <div className="px-6 pb-4 space-y-1 text-xs text-secondary">
            <div>
              CPP = cents per point &middot;{" "}
              <span className="text-green-600 dark:text-green-400">&#9733; Excellent &ge;2.5</span>{" "}
              <span className="text-blue-600 dark:text-blue-400">&#9733; Good &ge;2.0</span>{" "}
              <span className="text-yellow-600 dark:text-yellow-400">&#9733; Fair &ge;1.5</span>{" "}
              <span className="text-red-600 dark:text-red-400">&#9733; Poor &lt;1.5</span>
            </div>
            <div>
              Buy+Tax = cost of buying miles on marketplace + taxes &middot;{" "}
              <span className="text-green-600 dark:text-green-400">BUY</span> = buying miles is cheapest &middot;{" "}
              <span className="text-blue-600 dark:text-blue-400">REDEEM</span> = great value if you have miles &middot;{" "}
              <span className="text-gray-500 dark:text-gray-400">CASH</span> = cash is cheapest
            </div>
          </div>
        </div>
      </AppsSDKUIProvider>
    </McpUseProvider>
  );
};

export default FlightSearchResultWidget;
