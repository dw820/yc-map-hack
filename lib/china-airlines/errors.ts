export type SearchErrorCode =
  | "NO_RESULTS"
  | "FORM_INTERACTION_FAILED"
  | "TIMEOUT"
  | "CAPTCHA_DETECTED"
  | "SESSION_ERROR"
  | "PARSE_ERROR"
  | "INVALID_INPUT";

export class SearchError extends Error {
  public readonly code: SearchErrorCode;

  constructor(code: SearchErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SearchError";
    this.code = code;
  }
}
