import type { PointsListingResult } from "../../schemas/points-listing.js";

const allListings: PointsListingResult[] = [
  {
    id: "pb-mock-001",
    airline: "American Airlines",
    loyaltyProgram: "AAdvantage",
    milesAvailable: 50000,
    pricePerMile: 0.013,
    totalPrice: 650,
    sellerDisplayName: "MilesTrader88",
    sellerRating: 4.8,
    listingStatus: "active",
    postedDate: "2026-02-19",
  },
  {
    id: "pb-mock-002",
    airline: "United Airlines",
    loyaltyProgram: "MileagePlus",
    milesAvailable: 100000,
    pricePerMile: 0.012,
    totalPrice: 1200,
    sellerDisplayName: "FrequentFlyer42",
    sellerRating: 4.9,
    listingStatus: "active",
    postedDate: "2026-02-18",
  },
  {
    id: "pb-mock-003",
    airline: "Delta Air Lines",
    loyaltyProgram: "SkyMiles",
    milesAvailable: 75000,
    pricePerMile: 0.011,
    totalPrice: 825,
    sellerDisplayName: "PointsKing",
    sellerRating: 4.7,
    listingStatus: "active",
    postedDate: "2026-02-20",
  },
  {
    id: "pb-mock-004",
    airline: "China Airlines",
    loyaltyProgram: "Dynasty Flyer",
    milesAvailable: 35000,
    pricePerMile: 0.014,
    totalPrice: 490,
    sellerDisplayName: "AsiaFlyer",
    sellerRating: 4.6,
    listingStatus: "active",
    postedDate: "2026-02-17",
  },
  {
    id: "pb-mock-005",
    airline: "China Airlines",
    loyaltyProgram: "Dynasty Flyer",
    milesAvailable: 80000,
    pricePerMile: 0.0125,
    totalPrice: 1000,
    sellerDisplayName: "TaipeiTraveler",
    sellerRating: 4.5,
    listingStatus: "active",
    postedDate: "2026-02-16",
  },
  {
    id: "pb-mock-006",
    airline: "British Airways",
    loyaltyProgram: "Executive Club",
    milesAvailable: 60000,
    pricePerMile: 0.015,
    totalPrice: 900,
    sellerDisplayName: "LondonMiles",
    sellerRating: 4.9,
    listingStatus: "active",
    postedDate: "2026-02-19",
  },
  {
    id: "pb-mock-007",
    airline: "Singapore Airlines",
    loyaltyProgram: "KrisFlyer",
    milesAvailable: 120000,
    pricePerMile: 0.018,
    totalPrice: 2160,
    sellerDisplayName: "SuitesDreamer",
    sellerRating: 5.0,
    listingStatus: "active",
    postedDate: "2026-02-15",
  },
  {
    id: "pb-mock-008",
    airline: "Alaska Airlines",
    loyaltyProgram: "Mileage Plan",
    milesAvailable: 25000,
    pricePerMile: 0.0155,
    totalPrice: 387.5,
    sellerDisplayName: "PNWExplorer",
    sellerRating: 4.3,
    listingStatus: "active",
    postedDate: "2026-02-20",
  },
  {
    id: "pb-mock-009",
    airline: "American Airlines",
    loyaltyProgram: "AAdvantage",
    milesAvailable: 200000,
    pricePerMile: 0.0105,
    totalPrice: 2100,
    sellerDisplayName: "BulkMilesHQ",
    sellerRating: 4.4,
    listingStatus: "active",
    postedDate: "2026-02-14",
  },
  {
    id: "pb-mock-010",
    airline: "Cathay Pacific",
    loyaltyProgram: "Asia Miles",
    milesAvailable: 45000,
    pricePerMile: 0.016,
    totalPrice: 720,
    sellerDisplayName: "HKTraveler",
    sellerRating: 4.7,
    listingStatus: "active",
    postedDate: "2026-02-18",
  },
  {
    id: "pb-mock-011",
    airline: "China Airlines",
    loyaltyProgram: "Dynasty Flyer",
    milesAvailable: 150000,
    pricePerMile: 0.011,
    totalPrice: 1650,
    sellerDisplayName: "MilesBroker",
    sellerRating: 4.8,
    listingStatus: "active",
    postedDate: "2026-02-13",
  },
  {
    id: "pb-mock-012",
    airline: "EVA Air",
    loyaltyProgram: "Infinity MileageLands",
    milesAvailable: 40000,
    pricePerMile: 0.0135,
    totalPrice: 540,
    sellerDisplayName: "StarAllianceFan",
    sellerRating: 4.6,
    listingStatus: "active",
    postedDate: "2026-02-21",
  },
];

export function generateMockPointsListings(
  airline?: string
): PointsListingResult[] {
  if (!airline || airline === "all") {
    return allListings;
  }

  // Map IATA codes to airline names for filtering
  const iataMap: Record<string, string> = {
    AA: "American Airlines",
    UA: "United Airlines",
    DL: "Delta Air Lines",
    CI: "China Airlines",
    BA: "British Airways",
    SQ: "Singapore Airlines",
    AS: "Alaska Airlines",
    CX: "Cathay Pacific",
    BR: "EVA Air",
  };

  const airlineName = iataMap[airline.toUpperCase()] || airline;
  return allListings.filter(
    (l) =>
      l.airline.toLowerCase() === airlineName.toLowerCase() ||
      l.airline.toLowerCase().includes(airline.toLowerCase())
  );
}
