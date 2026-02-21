import React from "react";
import type { FlightResult } from "../types";

interface SavingsBreakdownProps {
  flight: FlightResult;
}

function fmt(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtMiles(miles: number): string {
  if (miles >= 1000) {
    return `${Math.round(miles / 1000)}K`;
  }
  return new Intl.NumberFormat("en-US").format(miles);
}

function fmtRate(rate: number): string {
  return `$${rate.toFixed(4)}/mi`;
}

export const SavingsBreakdown: React.FC<SavingsBreakdownProps> = ({
  flight,
}) => {
  const milesTaxes = flight.milesTaxes ?? 0;
  const savingsPct =
    flight.bestDeal === "buy" && flight.savings != null
      ? Math.round((flight.savings / flight.cashPrice) * 100)
      : null;

  // Determine which option is best for highlighting
  const bestOption = flight.bestDeal;

  return (
    <div className="py-3 px-4 space-y-2.5 text-sm">
      {/* Cash option */}
      <div
        className={`flex items-center justify-between rounded-lg px-3 py-2 ${
          bestOption === "cash"
            ? "bg-gray-100 dark:bg-gray-800/50 ring-1 ring-gray-300 dark:ring-gray-600"
            : "bg-surface"
        }`}
      >
        <div>
          <span className="font-medium">Pay Cash</span>
        </div>
        <span className="font-semibold">{fmt(flight.cashPrice)}</span>
      </div>

      {/* Redeem miles option */}
      {flight.milesPrice != null && (
        <div
          className={`flex items-center justify-between rounded-lg px-3 py-2 ${
            bestOption === "redeem"
              ? "bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300 dark:ring-blue-700"
              : "bg-surface"
          }`}
        >
          <div>
            <span className="font-medium">Redeem Miles</span>
            <span className="text-xs text-secondary ml-2">
              {fmtMiles(flight.milesPrice)} mi + {fmt(milesTaxes)} tax
            </span>
            {flight.centsPerPoint != null && flight.cppRating != null && (
              <span className="text-xs text-secondary ml-2">
                &middot; {flight.centsPerPoint.toFixed(1)} cpp
              </span>
            )}
          </div>
          <span className="font-semibold text-secondary">
            {fmt(milesTaxes)}
            <span className="text-xs font-normal"> + miles</span>
          </span>
        </div>
      )}

      {/* Buy miles option */}
      {flight.buyMilesPlusTaxes != null &&
        flight.buyMilesRate != null &&
        flight.milesPrice != null && (
          <div
            className={`flex items-center justify-between rounded-lg px-3 py-2 ${
              bestOption === "buy"
                ? "bg-green-50 dark:bg-green-900/20 ring-1 ring-green-300 dark:ring-green-700"
                : "bg-surface"
            }`}
          >
            <div>
              <span className="font-medium">Buy Miles & Redeem</span>
              <span className="text-xs text-secondary ml-2">
                {fmtMiles(flight.milesPrice)} &times; {fmtRate(flight.buyMilesRate)} +{" "}
                {fmt(milesTaxes)} tax
              </span>
            </div>
            <span className="font-semibold">
              {fmt(flight.buyMilesPlusTaxes)}
            </span>
          </div>
        )}

      {/* Best deal summary */}
      {bestOption === "buy" && flight.savings != null && (
        <div className="flex items-center gap-2 pt-1 text-green-700 dark:text-green-300 text-xs font-medium">
          <span>&#10003;</span>
          <span>
            Best deal: Buy miles & redeem — save {fmt(flight.savings)}
            {savingsPct != null && ` (${savingsPct}%)`}
          </span>
        </div>
      )}
      {bestOption === "redeem" && (
        <div className="flex items-center gap-2 pt-1 text-blue-700 dark:text-blue-300 text-xs font-medium">
          <span>&#10003;</span>
          <span>
            If you have miles, redeem for great value (
            {flight.centsPerPoint?.toFixed(1)} cpp)
          </span>
        </div>
      )}
    </div>
  );
};
