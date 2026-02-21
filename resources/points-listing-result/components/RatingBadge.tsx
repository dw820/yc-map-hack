import React from "react";

interface RatingBadgeProps {
  rating: number | undefined;
}

export const RatingBadge: React.FC<RatingBadgeProps> = ({ rating }) => {
  if (rating == null) {
    return <span className="text-xs text-secondary">N/A</span>;
  }

  const bg =
    rating >= 4.8
      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
      : rating >= 4.5
        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
        : rating >= 4.0
          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
          : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${bg}`}
    >
      &#9733; {rating.toFixed(1)}
    </span>
  );
};
