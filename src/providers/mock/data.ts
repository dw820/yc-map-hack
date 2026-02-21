import type { FlightResult } from "../../schemas/flight.js";

export function generateMockFlights(
  origin: string,
  destination: string,
  departDate: string,
  cabinClass?: string
): FlightResult[] {
  const base = parseDateStr(departDate);
  const cabin = cabinClass ?? "economy";

  const templates: Array<{
    flightNumber: string;
    departTime: string;
    arriveTime: string;
    duration: string;
    stops: number;
    cashByClass: Record<string, number>;
    milesPrice: number | null;
    milesTaxes: number | null;
  }> = [
    {
      flightNumber: "CI 005",
      departTime: "23:40",
      arriveTime: "05:20+1",
      duration: "13h 40m",
      stops: 0,
      cashByClass: { economy: 850, premium_economy: 1350, business: 3200, first: 8500 },
      milesPrice: 35000,
      milesTaxes: 45,
    },
    {
      flightNumber: "CI 007",
      departTime: "01:05",
      arriveTime: "06:50+1",
      duration: "13h 45m",
      stops: 0,
      cashByClass: { economy: 780, premium_economy: 1280, business: 3100, first: 8200 },
      milesPrice: 35000,
      milesTaxes: 45,
    },
    {
      flightNumber: "CI 031",
      departTime: "11:30",
      arriveTime: "06:15+1",
      duration: "18h 45m",
      stops: 1,
      cashByClass: { economy: 620, premium_economy: 1050, business: 2600, first: 7000 },
      milesPrice: 25000,
      milesTaxes: 38,
    },
    {
      flightNumber: "CI 005",
      departTime: "23:40",
      arriveTime: "05:20+1",
      duration: "13h 40m",
      stops: 0,
      cashByClass: { economy: 920, premium_economy: 1450, business: 3400, first: 9000 },
      milesPrice: 35000,
      milesTaxes: 45,
    },
    {
      flightNumber: "CI 007",
      departTime: "01:05",
      arriveTime: "06:50+1",
      duration: "13h 45m",
      stops: 0,
      cashByClass: { economy: 720, premium_economy: 1200, business: 2900, first: 7800 },
      milesPrice: 35000,
      milesTaxes: 45,
    },
    {
      flightNumber: "CI 031",
      departTime: "11:30",
      arriveTime: "06:15+1",
      duration: "18h 45m",
      stops: 1,
      cashByClass: { economy: 580, premium_economy: 980, business: 2400, first: 6500 },
      milesPrice: 25000,
      milesTaxes: 38,
    },
    {
      flightNumber: "CI 005",
      departTime: "23:40",
      arriveTime: "05:20+1",
      duration: "13h 40m",
      stops: 0,
      cashByClass: { economy: 950, premium_economy: 1500, business: 3500, first: 9200 },
      milesPrice: 35000,
      milesTaxes: 45,
    },
    {
      flightNumber: "CI 007",
      departTime: "01:05",
      arriveTime: "06:50+1",
      duration: "13h 45m",
      stops: 0,
      cashByClass: { economy: 680, premium_economy: 1150, business: 2800, first: 7500 },
      milesPrice: null,
      milesTaxes: null,
    },
    {
      flightNumber: "CI 031",
      departTime: "11:30",
      arriveTime: "06:15+1",
      duration: "18h 45m",
      stops: 1,
      cashByClass: { economy: 550, premium_economy: 950, business: 2300, first: 6200 },
      milesPrice: 25000,
      milesTaxes: 38,
    },
    {
      flightNumber: "CI 005",
      departTime: "23:40",
      arriveTime: "05:20+1",
      duration: "13h 40m",
      stops: 0,
      cashByClass: { economy: 1050, premium_economy: 1600, business: 3800, first: 9800 },
      milesPrice: 35000,
      milesTaxes: 45,
    },
    {
      flightNumber: "CI 007",
      departTime: "01:05",
      arriveTime: "06:50+1",
      duration: "13h 45m",
      stops: 0,
      cashByClass: { economy: 790, premium_economy: 1300, business: 3050, first: 8100 },
      milesPrice: 35000,
      milesTaxes: 45,
    },
    {
      flightNumber: "CI 031",
      departTime: "11:30",
      arriveTime: "06:15+1",
      duration: "18h 45m",
      stops: 1,
      cashByClass: { economy: 490, premium_economy: 880, business: 2200, first: 5800 },
      milesPrice: 25000,
      milesTaxes: 38,
    },
  ];

  return templates.map((t, i) => {
    const date = addDays(base, i);
    const dateStr = formatDate(date);
    const cashPrice = t.cashByClass[cabin] ?? t.cashByClass.economy;

    return {
      id: `mock-${dateStr}-${t.flightNumber.replace(/\s/g, "")}-${cabin}`,
      airline: "China Airlines",
      flightNumber: t.flightNumber,
      origin,
      destination,
      departDate: dateStr,
      departTime: t.departTime,
      arriveTime: t.arriveTime,
      duration: t.duration,
      stops: t.stops,
      cabinClass: cabin,
      cashPrice,
      cashCurrency: "USD",
      milesPrice: t.milesPrice,
      milesTaxes: t.milesTaxes,
      centsPerPoint: null, // computed by service
      cppRating: null,     // computed by service
      buyMilesRate: null,  // computed by unified service
      buyMilesTotal: null,
      buyMilesPlusTaxes: null,
      bestDeal: null,
      savings: null,
    };
  });
}

function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
