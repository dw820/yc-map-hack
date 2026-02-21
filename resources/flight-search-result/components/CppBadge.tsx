import React from "react";

interface CppBadgeProps {
  cpp: number | null;
  rating: "excellent" | "good" | "fair" | "poor" | null;
}

const ratingConfig = {
  excellent: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", stars: 4 },
  good: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", stars: 3 },
  fair: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", stars: 2 },
  poor: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", stars: 1 },
} as const;

export const CppBadge: React.FC<CppBadgeProps> = ({ cpp, rating }) => {
  if (cpp == null || rating == null) {
    return <span className="text-xs text-secondary">N/A</span>;
  }

  const config = ratingConfig[rating];
  const stars = "\u2605".repeat(config.stars) + "\u2606".repeat(4 - config.stars);

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {cpp.toFixed(1)}
      <span className="text-[10px]">{stars}</span>
    </span>
  );
};
