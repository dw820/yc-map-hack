import React from "react";
import type { PointsListing } from "../types";
import { RatingBadge } from "./RatingBadge";

interface ListingRowProps {
  listing: PointsListing;
  onSelect: (listing: PointsListing) => void;
}

export const ListingRow: React.FC<ListingRowProps> = ({
  listing,
  onSelect,
}) => {
  return (
    <tr
      className="border-b border-subtle hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
      onClick={() => onSelect(listing)}
    >
      <td className="px-3 py-3 text-sm font-medium whitespace-nowrap">
        {listing.airline}
      </td>
      <td className="px-3 py-3 text-sm whitespace-nowrap text-secondary">
        {listing.loyaltyProgram || "\u2014"}
      </td>
      <td className="px-3 py-3 text-sm whitespace-nowrap">
        {formatMiles(listing.milesAvailable)}
      </td>
      <td className="px-3 py-3 text-sm font-semibold whitespace-nowrap">
        ${listing.pricePerMile.toFixed(4)}
      </td>
      <td className="px-3 py-3 text-sm whitespace-nowrap">
        {listing.totalPrice != null
          ? formatCurrency(listing.totalPrice)
          : "\u2014"}
      </td>
      <td className="px-3 py-3 text-sm whitespace-nowrap text-secondary">
        {listing.sellerDisplayName || "\u2014"}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <RatingBadge rating={listing.sellerRating} />
      </td>
    </tr>
  );
};

function formatMiles(miles: number): string {
  return new Intl.NumberFormat("en-US").format(miles);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}
