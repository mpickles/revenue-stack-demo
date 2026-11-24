import { gtag } from "./dataLayer";

export type ConsentChoice = "granted" | "denied";

export const CONSENT_COOKIE = "rw_consent";
const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

// When the choice was made, as an ISO 8601 UTC time. Like rw_consent it
// records the choice itself, so it is written on Accept and on Reject.
export const CONSENT_TIME_COOKIE = "rw_consent_at";

export const CONSENT_OPEN_EVENT = "rw:consent-open";

export function consentSignals(choice: ConsentChoice) {
  return {
    ad_storage: choice,
    analytics_storage: choice,
    ad_user_data: choice,
    ad_personalization: choice,
  };
}

export function readConsent(): ConsentChoice | null {
  const match = document.cookie.match(/(?:^|; )rw_consent=(granted|denied)(?:;|$)/);
  return match ? (match[1] as ConsentChoice) : null;
}

const ISO_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

// Returns the time as ISO 8601 UTC, or null when the text is not a real time.
export function toConsentTimestamp(raw: string): string | null {
  if (!ISO_TIME_PATTERN.test(raw)) return null;
  const time = Date.parse(raw);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

// The time of the stored choice, or empty when there is none.
export function readConsentTime(): string {
  const match = document.cookie.match(/(?:^|; )rw_consent_at=([^;]*)/);
  if (!match || !match[1]) return "";
  try {
    return toConsentTimestamp(decodeURIComponent(match[1])) ?? "";
  } catch {
    return "";
  }
}

// The consent values a lead carries. They are always sent, with or without
// consent, because they record the choice itself.
export type ConsentState = {
  ad_user_data_consent: boolean;
  ad_personalization_consent: boolean;
  ad_consent_timestamp: string;
};

// The banner has one Accept all and one Reject all, so the two booleans
// always match (see docs/decisions.md). Both are false before any choice.
export function readConsentState(): ConsentState {
  const granted = readConsent() === "granted";
  return {
    ad_user_data_consent: granted,
    ad_personalization_consent: granted,
    ad_consent_timestamp: readConsentTime(),
  };
}

export function setConsent(choice: ConsentChoice): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const attributes = `Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  const chosenAt = encodeURIComponent(new Date().toISOString());
  document.cookie = `${CONSENT_COOKIE}=${choice}; ${attributes}`;
  document.cookie = `${CONSENT_TIME_COOKIE}=${chosenAt}; ${attributes}`;
  gtag("consent", "update", consentSignals(choice));
}
