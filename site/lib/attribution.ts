import { ATTRIBUTION_KEYS, parseClickIds, type Attribution } from "./clickIds";
import type { ConsentChoice } from "./consent";

export const ATTRIBUTION_COOKIE = "rw_attrib";
const ATTRIBUTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

// Landing values seen before ad storage was granted. Memory only: a full
// reload before consent loses them (see docs/decisions.md).
let pending: Attribution | null = null;

function writeCookie(values: Attribution): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const value = encodeURIComponent(JSON.stringify(values));
  document.cookie =
    `${ATTRIBUTION_COOKIE}=${value}; Max-Age=${ATTRIBUTION_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

function deleteCookie(): void {
  document.cookie = `${ATTRIBUTION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

// Call once per page load. A landing with parameters replaces the whole
// stored set; a landing without any leaves the stored set alone.
export function captureLanding(search: string, consent: ConsentChoice | null): void {
  const found = parseClickIds(search);
  if (Object.keys(found).length === 0) return;
  if (consent === "granted") {
    writeCookie(found);
    pending = null;
  } else {
    pending = found;
  }
}

export function applyConsent(choice: ConsentChoice): void {
  if (choice === "granted") {
    if (pending) writeCookie(pending);
    pending = null;
  } else {
    deleteCookie();
  }
}

export function readAttribution(): Attribution {
  const match = document.cookie.match(/(?:^|; )rw_attrib=([^;]*)/);
  if (!match || !match[1]) return {};
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(match[1]));
    const values: Attribution = {};
    if (parsed && typeof parsed === "object") {
      for (const key of ATTRIBUTION_KEYS) {
        const value = (parsed as Record<string, unknown>)[key];
        if (typeof value === "string" && value) values[key] = value;
      }
    }
    return values;
  } catch {
    return {};
  }
}

export function resetPendingForTests(): void {
  pending = null;
}
