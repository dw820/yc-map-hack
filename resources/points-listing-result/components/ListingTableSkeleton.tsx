import React from "react";

export const ListingTableSkeleton: React.FC = () => {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-3 py-3">
          {Array.from({ length: 6 }).map((_, j) => (
            <div
              key={j}
              className="h-4 rounded-md bg-default/10 animate-pulse"
              style={{ width: `${60 + Math.random() * 40}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
