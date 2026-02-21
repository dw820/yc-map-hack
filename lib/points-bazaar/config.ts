export const BASE_URL = "https://pointsbazaar.com/mileage";

export function buildSearchUrl(
  airline: string,
  milesRange: string,
  unitPriceRange: string
): string {
  const params = new URLSearchParams({
    airline: airline === "all" ? "" : airline,
    milesRange,
    unitPriceRange,
  });
  return `${BASE_URL}/selling?${params.toString()}`;
}

export const FIRECRAWL_INSTRUCTIONS =
  "Extract all marketplace listings for airline miles. For each listing, capture: airline name, loyalty program, miles quantity available, price per mile in USD, total price, seller display name, seller rating, listing status, and posted date.";

export const KNOWN_AIRLINES: Record<string, string> = {
  "China Airlines": "CI",
  "American Airlines": "AA",
  "United Airlines": "UA",
  "Delta Air Lines": "DL",
  "Alaska Airlines": "AS",
  "British Airways": "BA",
  "Singapore Airlines": "SQ",
  "Cathay Pacific": "CX",
  "Emirates": "EK",
  "Japan Airlines": "JL",
  "ANA": "NH",
  "Korean Air": "KE",
  "Air France": "AF",
  "Lufthansa": "LH",
  "Qantas": "QF",
  "Southwest Airlines": "WN",
  "JetBlue": "B6",
  "Air Canada": "AC",
  "Turkish Airlines": "TK",
  "EVA Air": "BR",
};

export const IATA_TO_AIRLINE: Record<string, string> = Object.fromEntries(
  Object.entries(KNOWN_AIRLINES).map(([name, code]) => [code, name])
);

export const FIRECRAWL_WAIT_MS = 3000;
