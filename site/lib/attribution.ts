import { ATTRIBUTION_KEYS, CLICK_ID_KEYS, parseClickIds } from "./clickIds";
import type { ConsentChoice } from "./consent";
import { VISIT_KEYS, landingPath, referringDomain } from "./referrer";

// Everything the attribution cookie may hold: click IDs, UTM values, the
// referring domain and the landing page. All of it sits behind one gate.
export const STORED_KEYS = [...ATTRIBUTION_KEYS, ...VISIT_KEYS] as const;
export type StoredKey = (typeof STORED_KEYS)[number];
export type StoredAttribution = Partial<Record<StoredKey, string>>;

// What the browser knows about a landing besides its query string.
export type LandingPage = { referrer: string; host: string; path: string };

// A landing has a source when it carries a click ID, a UTM value or a
// referring domain. Only a landing with a source may change a stored set.
type Landing = { values: StoredAttribution; sourced: boolean };

export const ATTRIBUTION_COOKIE = "rw_attrib";
const ATTRIBUTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

// Landing values seen before ad storage was granted. Memory only: a full
// reload before consent loses them (see docs/decisions.md).
let pending: Landing | null = null;

function writeCookie(values: StoredAttribution): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const value = encodeURIComponent(JSON.stringify(values));
  document.cookie =
    `${ATTRIBUTION_COOKIE}=${value}; Max-Age=${ATTRIBUTION_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

function deleteCookie(): void {
  document.cookie = `${ATTRIBUTION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

// The stored set has two groups. The click IDs are replaced, as a group, only
// by a landing that carries a click ID: the conversion upload needs them, and
// a later visit with no click ID says nothing about which ad was clicked.
// Everything else (UTM values, referring domain, landing page) is the latest
// touch and is replaced by any landing with a source.
function store(landing: Landing): void {
  const stored = readAttribution();
  if (!landing.sourced) {
    if (Object.keys(stored).length === 0) writeCookie(landing.values);
    return;
  }
  const next: StoredAttribution = { ...landing.values };
  if (!CLICK_ID_KEYS.some((key) => landing.values[key])) {
    for (const key of CLICK_ID_KEYS) {
      if (stored[key]) next[key] = stored[key];
    }
  }
  writeCookie(next);
}

// Call once per page load. A landing without a source leaves a stored set
// alone, and stores its landing page only when nothing is stored yet.
export function captureLanding(search: string, consent: ConsentChoice | null, page?: LandingPage): void {
  const values: StoredAttribution = parseClickIds(search);
  const domain = page ? referringDomain(page.referrer, page.host) : "";
  if (domain) values.referring_domain = domain;
  const sourced = Object.keys(values).length > 0;
  const path = page ? landingPath(page.path) : "";
  if (path) values.landing_page = path;
  if (Object.keys(values).length === 0) return;

  const landing: Landing = { values, sourced };
  if (consent === "granted") {
    store(landing);
    pending = null;
  } else {
    pending = landing;
  }
}

export function applyConsent(choice: ConsentChoice): void {
  if (choice === "granted") {
    if (pending) store(pending);
    pending = null;
  } else {
    deleteCookie();
  }
}

export function readAttribution(): StoredAttribution {
  const match = document.cookie.match(/(?:^|; )rw_attrib=([^;]*)/);
  if (!match || !match[1]) return {};
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(match[1]));
    const values: StoredAttribution = {};
    if (parsed && typeof parsed === "object") {
      for (const key of STORED_KEYS) {
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
