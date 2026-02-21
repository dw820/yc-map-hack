import { AppsSDKUIProvider } from "@openai/apps-sdk-ui/components/AppsSDKUIProvider";
import {
  McpUseProvider,
  useCallTool,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import React from "react";
import { Link } from "react-router";
import "../styles.css";
import { ListingsTable } from "./components/ListingsTable";
import { ListingTableSkeleton } from "./components/ListingTableSkeleton";
import type { PointsListingSearchResultProps, PointsListing } from "./types";
import { propSchema } from "./types";

export const widgetMetadata: WidgetMetadata = {
  description:
    "Display PointsBazaar marketplace listings for airline miles with pricing, seller ratings, and sorting",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Searching PointsBazaar...",
    invoked: "Listings loaded",
  },
};

const PointsListingResultWidget: React.FC = () => {
  const { props, isPending, sendFollowUpMessage } =
    useWidget<PointsListingSearchResultProps>();

  const {
    callTool: getListingDetails,
    data: listingDetails,
    isPending: isLoadingDetails,
  } = useCallTool("get-listing-details");

  if (isPending) {
    return (
      <McpUseProvider>
        <div className="relative bg-surface-elevated border border-default rounded-3xl">
          <div className="p-6 pb-3">
            <h5 className="text-secondary mb-1 text-sm">PointsBazaar</h5>
            <h2 className="heading-xl mb-2">Miles Marketplace</h2>
            <div className="h-4 w-56 rounded-md bg-default/10 animate-pulse" />
          </div>
          <div className="px-6 pb-6">
            <ListingTableSkeleton />
          </div>
        </div>
      </McpUseProvider>
    );
  }

  const { listings, searchParams } = props;
  const airlineLabel = searchParams.airline || "All Airlines";

  const handleSelectListing = (listing: PointsListing) => {
    getListingDetails({ listingId: listing.id });
    sendFollowUpMessage(
      `Tell me about this PointsBazaar listing: ${listing.milesAvailable.toLocaleString()} ${listing.airline} miles ` +
        `at $${listing.pricePerMile.toFixed(4)}/mile (total $${listing.totalPrice?.toFixed(2) ?? "N/A"})` +
        (listing.sellerDisplayName
          ? ` from seller "${listing.sellerDisplayName}" (rating: ${listing.sellerRating ?? "N/A"}/5).`
          : ".") +
        ` Is this a good price? How does it compare to buying miles directly from the airline?`
    );
  };

  const selectedListing = listingDetails?.structuredContent as
    | PointsListing
    | undefined;

  return (
    <McpUseProvider>
      <AppsSDKUIProvider linkComponent={Link}>
        <div className="relative bg-surface-elevated border border-default rounded-3xl">
          {/* Header */}
          <div className="p-6 pb-3">
            <h5 className="text-secondary mb-1 text-sm">PointsBazaar</h5>
            <h2 className="heading-xl mb-1">Miles Marketplace</h2>
            <p className="text-sm text-secondary">
              {listings.length} listings found &middot; {airlineLabel}
            </p>
          </div>

          {/* Listings Table */}
          <div className="px-2 pb-4">
            <ListingsTable
              listings={listings}
              onSelectListing={handleSelectListing}
            />
          </div>

          {/* Selected listing detail */}
          {selectedListing && (
            <div className="mx-6 mb-6 rounded-2xl border border-default bg-surface p-4">
              {isLoadingDetails ? (
                <div className="animate-pulse h-4 w-48 bg-surface-elevated rounded" />
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-base">
                      {selectedListing.airline}{" "}
                      {selectedListing.loyaltyProgram &&
                        `\u00b7 ${selectedListing.loyaltyProgram}`}
                    </h3>
                    <p className="text-sm text-secondary mt-1">
                      {selectedListing.milesAvailable.toLocaleString()} miles
                      available
                      {selectedListing.sellerDisplayName &&
                        ` \u00b7 Seller: ${selectedListing.sellerDisplayName}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      ${selectedListing.pricePerMile.toFixed(4)}/mi
                    </div>
                    {selectedListing.totalPrice != null && (
                      <div className="text-sm text-secondary">
                        Total: $
                        {selectedListing.totalPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-6 pb-4 text-xs text-secondary">
            Prices shown are from third-party sellers on PointsBazaar. Always
            verify listing details before purchasing.
          </div>
        </div>
      </AppsSDKUIProvider>
    </McpUseProvider>
  );
};

export default PointsListingResultWidget;
