export const CHINA_AIRLINES_URL = "https://www.china-airlines.com/us/en";

export const TIMEOUTS = {
  pageLoad: 30_000,
  searchResults: 60_000,
  elementInteraction: 10_000,
  contextSync: 5_000,
} as const;

export const DELAYS = {
  base: 500,
  jitterMax: 300,
} as const;

/**
 * CSS selectors for the China Airlines booking form.
 * Refined from live DOM inspection via Browserbase session replay.
 */
export const SELECTORS = {
  // Trip type — custom dropdown (the radio inputs are display:none)
  tripTypeDropdownButton: '#fr-dropdownButton',
  oneWayDropdownOption: 'li[data-value="one-way"]',

  // Origin / Destination inputs
  originInput: '#From-booking',
  destinationInput: '#To-booking',

  // Airport popup modal — appears when clicking an airport input
  airportPopupModal: '.airport-popup',
  airportPopupSelectBtn: 'button.btn-brand-pink.search-btn',

  // Date picker
  departureDateTrigger: '.result.result-oneway',
  monthJumpSelect: '#monthChanger',
  calendarNextMonth: '.left-button-cal button',
  calendarDayButton: (day: number) =>
    `td[role="gridcell"]:not(.text-muted) button span:has-text("${day}")`,

  // Cabin class radios
  cabinClassTrigger: '.cal-group-drop-show',
  cabinRadio: {
    economy: '#simple-Economy-class',
    'premium-economy': '#simple-Premium-Economy-class',
    business: '#simple-Business-class',
  } as Record<string, string>,

  // Search button
  searchButton: 'a[ng-click="flightsearchresult()"]',

  // Results page
  loadingSpinner: [
    '.loading-spinner',
    '.search-loading',
    '[data-loading="true"]',
    '.spinner',
  ],
  resultsContainer: [
    '.flight-results',
    '.search-results',
    '.flight-list',
    '[data-results]',
  ],
  noResults: [
    '.no-results',
    '.no-flights',
    'text=No flights found',
    'text=no available flights',
  ],
  flightCard: [
    '.flight-card',
    '.flight-item',
    '.flight-row',
    '.itinerary-card',
  ],
} as const;

/** URL patterns that likely contain flight search API responses */
export const API_RESPONSE_PATTERNS = [
  "**/v2/search/air-bounds**",
  "**/v2/search/air-calendars**",
  "**/api/**/flight**",
  "**/api/**/search**",
  "**/api/**/availability**",
  "**/booking/**/search**",
  "**/fare**",
  "**/FlightSearchResults**",
] as const;
