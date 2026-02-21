import React from "react";

export const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12 text-secondary">
    <span className="text-3xl mb-2">&#128178;</span>
    <p className="text-sm">No listings match your filters</p>
  </div>
);
