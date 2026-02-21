export type AwardSearchErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_EXPIRED"
  | "LOGIN_TIMEOUT"
  | "NAVIGATION_FAILED"
  | "NO_RESULTS"
  | "FORM_INTERACTION_FAILED"
  | "TIMEOUT"
  | "SESSION_ERROR"
  | "PARSE_ERROR"
  | "INVALID_INPUT";

export class AwardSearchError extends Error {
  public readonly code: AwardSearchErrorCode;

  constructor(code: AwardSearchErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AwardSearchError";
    this.code = code;
  }
}
