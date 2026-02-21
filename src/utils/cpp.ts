export type CppRating = "excellent" | "good" | "fair" | "poor";

export function calculateCpp(
  cashPrice: number,
  milesPrice: number | null,
  milesTaxes: number | null
): number | null {
  if (milesPrice == null || milesPrice <= 0) return null;
  const taxes = milesTaxes ?? 0;
  return ((cashPrice - taxes) / milesPrice) * 100;
}

export function getCppRating(cpp: number | null): CppRating | null {
  if (cpp == null) return null;
  if (cpp >= 2.5) return "excellent";
  if (cpp >= 2.0) return "good";
  if (cpp >= 1.5) return "fair";
  return "poor";
}
