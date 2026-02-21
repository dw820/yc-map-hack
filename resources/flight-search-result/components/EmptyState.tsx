import React from "react";

export const EmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-4xl mb-3">&#9992;</div>
      <h3 className="text-lg font-semibold text-default mb-1">No flights found</h3>
      <p className="text-sm text-secondary max-w-xs">
        Try adjusting your search dates or route to find available flights.
      </p>
    </div>
  );
};
