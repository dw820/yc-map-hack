export const CHINA_AIRLINES_BASE_URL = "https://www.china-airlines.com/us/en";

export const DYNASTY_FLYER_DASHBOARD_URL =
  "https://dynasty-flyer.china-airlines.com/member/dashboard";

export const DYNASTY_FLYER_LOGIN_URL =
  "https://dynasty-flyer.china-airlines.com/member/auth/login?clientType=part-chl&redirectTo=https://www.china-airlines.com/us/en/";

export const AWARD_PAGE_URL_PATTERN =
  /membersonair\.china-airlines\.com\/AwardTicketSeat/;

export const LOGIN_PAGE_URL_PATTERN =
  /dynasty-flyer\.china-airlines\.com\/member\/auth\/login/;

/** Matches any page on the dynasty-flyer auth domain (login, email verify, OTP, etc.) */
export const DYNASTY_FLYER_DOMAIN_PATTERN =
  /dynasty-flyer\.china-airlines\.com/;

/** Matches the post-login redirect target on the main china-airlines.com site */
export const AUTH_REDIRECT_URL_PATTERN =
  /www\.china-airlines\.com/;

export const TIMEOUTS = {
  pageLoad: 30_000,
  searchResults: 90_000,
  elementInteraction: 10_000,
  contextSync: 5_000,
  loginPolling: 300_000, // 5 minutes for manual login
  loginPollInterval: 5_000,
  awardPageNavigation: 30_000,
  browserbaseSessionTimeout: 3_600, // 1 hour in seconds (max 6 hours = 21600)
} as const;

export const DELAYS = {
  base: 500,
  jitterMax: 300,
} as const;

/** Selectors for detecting logged-in state on china-airlines.com */
export const LOGIN_SELECTORS = {
  // Indicators that the user is logged in (header shows "HI Member" when authenticated)
  // NOTE: "Dynasty Member" is the PRE-LOGIN text — do NOT use it as a logged-in indicator
  loggedInIndicators: [
    ':is(a, span, div):has-text("HI Member")',
    ':is(a, span, div):has-text("Hi Member")',
    ".member-name",
    ".user-name",
    ".login-member-info",
  ],
  // The member menu trigger (top-right header button — logged in or not)
  memberMenuTrigger: [
    ':is(a, button):has-text("HI Member")',
    ':is(a, button):has-text("Hi Member")',
    ':is(a, button):has-text("Dynasty Member")',
    '.member-menu-trigger',
    '.login-after',
  ],
  // Text patterns that indicate NOT logged in (used to filter memberMenuTrigger matches)
  notLoggedInPatterns: /log\s*in|sign\s*in|register|dynasty\s*member/i,
  // Link to award/reward ticket search from member dashboard or dropdown
  awardBookingLink: [
    'a:has-text("Reward Ticket")',
    'a:has-text("Award Ticket")',
    'a[href*="AwardTicket"]',
    'a[href*="reward-ticket"]',
    'a:has-text("Redeem")',
  ],
} as const;

/** Selectors for the award search form on membersonair.china-airlines.com */
export const AWARD_FORM_SELECTORS = {
  // Notice agreement checkbox (must be checked before searching)
  agreeCheckbox: "#chkRead",

  // Trip type
  oneWayRadio: "#rbnOneWay",
  roundTripRadio: "#rbnRoundTrip",

  // Origin / Destination (autocomplete text inputs)
  originInput: "#txtDepStn",
  destinationInput: "#txtArvStn",

  // Date (jQuery datepicker, readonly — set via JS)
  departureDateInput: "#txtDepDatePicker",
  returnDateInput: "#txtRetDatePicker",

  // Cabin class radio buttons
  cabinRadio: {
    economy: "#rbnECONOMYAS",
    "premium-economy": "#rbnPREMIUMAS",
    business: "#rbnBUSINESSAS",
  } as Record<string, string>,

  // Search button
  searchButton: "#btnSubmit",

  // Results loading indicators
  loadingSpinner: [
    ".loading-mask",
    ".loading-spinner",
    ".search-loading",
    '[data-loading="true"]',
    ".spinner",
    ".loading",
  ],
} as const;

/** URL patterns for intercepting award API responses */
export const AWARD_API_RESPONSE_PATTERNS = [
  "**/AwardTicketSeat/**",
  "**/Award/**",
  "**/api/**/award**",
  "**/api/**/mileage**",
  "**/api/**/redeem**",
  "**/api/**/availability**",
  "**/SearchAward**",
  "**/GetAwardFlights**",
] as const;
