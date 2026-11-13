import { gtag } from "./dataLayer";

export type ConsentChoice = "granted" | "denied";

export const CONSENT_COOKIE = "rw_consent";
const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

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

export function setConsent(choice: ConsentChoice): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${CONSENT_COOKIE}=${choice}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  gtag("consent", "update", consentSignals(choice));
}
