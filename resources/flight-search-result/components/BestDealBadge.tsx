import React from "react";

interface BestDealBadgeProps {
  bestDeal: "cash" | "redeem" | "buy" | null;
  savings: number | null;
}

const dealConfig = {
  buy: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    label: "BUY",
  },
  redeem: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    label: "REDEEM",
  },
  cash: {
    bg: "bg-gray-100 dark:bg-gray-800/50",
    text: "text-gray-600 dark:text-gray-400",
    label: "CASH",
  },
} as const;

function formatSavings(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export const BestDealBadge: React.FC<BestDealBadgeProps> = ({
  bestDeal,
  savings,
}) => {
  if (bestDeal == null) {
    return <span className="text-xs text-secondary">—</span>;
  }

  const config = dealConfig[bestDeal];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
      {bestDeal === "buy" && savings != null && (
        <span className="text-[10px] opacity-80">
          save {formatSavings(savings)}
        </span>
      )}
    </span>
  );
};
