import React from "react";

const SKELETON_ROWS = 6;
const SKELETON_COLS = 8;

export const FlightTableSkeleton: React.FC = () => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-default">
            {Array.from({ length: SKELETON_COLS }).map((_, i) => (
              <th key={i} className="px-3 py-2">
                <div className="h-3 w-14 rounded bg-default/10 animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SKELETON_ROWS }).map((_, row) => (
            <tr key={row} className="border-b border-subtle">
              {Array.from({ length: SKELETON_COLS }).map((_, col) => (
                <td key={col} className="px-3 py-3">
                  <div
                    className="h-4 rounded bg-default/10 animate-pulse"
                    style={{ width: `${50 + Math.random() * 30}%` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
