export type ListingSearchErrorCode =
  | "NO_RESULTS"
  | "TIMEOUT"
  | "PARSE_ERROR"
  | "INVALID_INPUT"
  | "API_ERROR";

export class ListingSearchError extends Error {
  public readonly code: ListingSearchErrorCode;

  constructor(
    code: ListingSearchErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ListingSearchError";
    this.code = code;
  }
}
