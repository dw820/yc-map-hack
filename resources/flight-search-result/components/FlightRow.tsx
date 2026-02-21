import React from "react";
import type { FlightResult } from "../types";
import { CppBadge } from "./CppBadge";
import { BestDealBadge } from "./BestDealBadge";

interface FlightRowProps {
  flight: FlightResult;
  isExpanded: boolean;
  onToggleExpand: (flight: FlightResult) => void;
  onSelect: (flight: FlightResult) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMiles(miles: number | null): string {
  if (miles == null) return "—";
  return new Intl.NumberFormat("en-US").format(miles);
}

export const FlightRow: React.FC<FlightRowProps> = ({
  flight,
  isExpanded,
  onToggleExpand,
  onSelect,
}) => {
  const milesTaxes = flight.milesTaxes ?? 0;

  return (
    <tr
      className={`border-b border-subtle cursor-pointer transition-colors ${
        isExpanded
          ? "bg-black/[0.03] dark:bg-white/[0.03]"
          : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
      }`}
      onClick={() => onToggleExpand(flight)}
    >
      <td className="px-3 py-3 text-sm whitespace-nowrap">
        {formatDate(flight.departDate)}
      </td>
      <td className="px-3 py-3 text-sm font-medium whitespace-nowrap">
        {flight.flightNumber}
      </td>
      <td className="px-3 py-3 text-sm whitespace-nowrap">
        {flight.origin}&#8594;{flight.destination}
      </td>
      <td className="px-3 py-3 text-sm whitespace-nowrap">
        <div>{flight.departTime}</div>
        <div className="text-xs text-secondary">
          {flight.duration}{" "}
          {flight.stops === 0 ? "nonstop" : `${flight.stops} stop`}
        </div>
      </td>
      <td className="px-3 py-3 text-sm font-semibold whitespace-nowrap">
        {formatCurrency(flight.cashPrice, flight.cashCurrency)}
      </td>
      <td className="px-3 py-3 text-sm whitespace-nowrap">
        {flight.milesPrice != null ? (
          <div>
            <span>{formatMiles(flight.milesPrice)}</span>
            <span className="text-xs text-secondary ml-1">
              +{formatCurrency(milesTaxes, flight.cashCurrency)}
            </span>
          </div>
        ) : (
          <span className="text-secondary">—</span>
        )}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <CppBadge cpp={flight.centsPerPoint} rating={flight.cppRating} />
      </td>
      <td className="px-3 py-3 text-sm font-semibold whitespace-nowrap">
        {flight.buyMilesPlusTaxes != null
          ? formatCurrency(flight.buyMilesPlusTaxes, flight.cashCurrency)
          : "—"}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <BestDealBadge
            bestDeal={flight.bestDeal}
            savings={flight.savings}
          />
          <span
            className={`text-xs text-secondary transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          >
            &#9660;
          </span>
        </div>
      </td>
    </tr>
  );
};
