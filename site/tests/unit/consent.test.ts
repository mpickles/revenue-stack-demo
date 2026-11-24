import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_COOKIE,
  CONSENT_TIME_COOKIE,
  readConsent,
  readConsentState,
  readConsentTime,
  setConsent,
  toConsentTimestamp,
} from "@/lib/consent";

const HALF_YEAR_SECONDS = 180 * 24 * 60 * 60;
const CHOSEN_AT = "2026-11-23T18:04:05.000Z";

// jsdom hides cookie attributes on read, so record every raw write.
let writes: string[] = [];
const native = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;

function clearCookies() {
  for (const name of [CONSENT_COOKIE, CONSENT_TIME_COOKIE]) {
    native.set!.call(document, `${name}=; Max-Age=0; Path=/`);
  }
}

beforeEach(() => {
  clearCookies();
  writes = [];
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => native.get!.call(document),
    set: (value: string) => {
      writes.push(value);
      native.set!.call(document, value);
    },
  });
  window.dataLayer = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(CHOSEN_AT));
});

afterEach(() => {
  vi.useRealTimers();
  delete (document as { cookie?: string }).cookie;
  clearCookies();
});

describe("consent state for the lead payload", () => {
  it("is false, false and no time before any choice", () => {
    expect(readConsentState()).toEqual({
      ad_user_data_consent: false,
      ad_personalization_consent: false,
      ad_consent_timestamp: "",
    });
  });

  it("is true, true and the time of the choice after Accept all", () => {
    setConsent("granted");
    expect(readConsentState()).toEqual({
      ad_user_data_consent: true,
      ad_personalization_consent: true,
      ad_consent_timestamp: CHOSEN_AT,
    });
  });

  it("is false, false and the time of the choice after Reject all", () => {
    setConsent("denied");
    expect(readConsentState()).toEqual({
      ad_user_data_consent: false,
      ad_personalization_consent: false,
      ad_consent_timestamp: CHOSEN_AT,
    });
  });

  it("gives both booleans the same value, because the banner has one choice", () => {
    for (const choice of ["granted", "denied"] as const) {
      setConsent(choice);
      const state = readConsentState();
      expect(state.ad_user_data_consent).toBe(state.ad_personalization_consent);
    }
  });

  it("replaces the time when the visitor changes the choice", () => {
    setConsent("granted");
    vi.setSystemTime(new Date("2026-11-24T09:00:00.000Z"));
    setConsent("denied");
    expect(readConsentState()).toEqual({
      ad_user_data_consent: false,
      ad_personalization_consent: false,
      ad_consent_timestamp: "2026-11-24T09:00:00.000Z",
    });
  });

  it("keeps the time of the choice, not the time it is read", () => {
    setConsent("granted");
    vi.setSystemTime(new Date("2026-12-01T00:00:00.000Z"));
    expect(readConsentState().ad_consent_timestamp).toBe(CHOSEN_AT);
  });

  it("stores the time in a first-party cookie with the same lifetime as the choice", () => {
    setConsent("denied");
    const choice = writes.find((w) => w.startsWith(`${CONSENT_COOKIE}=`))!;
    const time = writes.find((w) => w.startsWith(`${CONSENT_TIME_COOKIE}=`))!;
    for (const write of [choice, time]) {
      expect(write).toContain(`Max-Age=${HALF_YEAR_SECONDS}`);
      expect(write).toContain("Path=/");
      expect(write).toContain("SameSite=Lax");
    }
  });

  it("still reads the choice cookie the same way", () => {
    setConsent("granted");
    expect(readConsent()).toBe("granted");
    setConsent("denied");
    expect(readConsent()).toBe("denied");
  });

  it("still updates all four consent mode signals on a choice", () => {
    setConsent("granted");
    const update = Array.from(window.dataLayer.at(-1) as ArrayLike<unknown>);
    expect(update).toEqual([
      "consent",
      "update",
      {
        ad_storage: "granted",
        analytics_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      },
    ]);
  });

  it("puts no time and no consent boolean in the data layer", () => {
    setConsent("granted");
    const pushed = JSON.stringify(window.dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>)));
    expect(pushed).not.toContain(CHOSEN_AT);
    expect(pushed).not.toContain("ad_user_data_consent");
  });

  it("reports a saved choice with no saved time as the choice and an empty time", () => {
    document.cookie = `${CONSENT_COOKIE}=granted; Path=/`;
    expect(readConsentState()).toEqual({
      ad_user_data_consent: true,
      ad_personalization_consent: true,
      ad_consent_timestamp: "",
    });
  });

  it("reads a damaged time cookie as empty", () => {
    document.cookie = `${CONSENT_TIME_COOKIE}=yesterday; Path=/`;
    expect(readConsentTime()).toBe("");
    document.cookie = `${CONSENT_TIME_COOKIE}=%E0%A4%A; Path=/`;
    expect(readConsentTime()).toBe("");
  });
});

describe("toConsentTimestamp", () => {
  it("accepts an ISO 8601 time and returns it in UTC", () => {
    expect(toConsentTimestamp(CHOSEN_AT)).toBe(CHOSEN_AT);
    expect(toConsentTimestamp("2026-11-23T18:04:05Z")).toBe(CHOSEN_AT);
    expect(toConsentTimestamp("2026-11-23T12:04:05-06:00")).toBe(CHOSEN_AT);
  });

  it("rejects anything that is not a full ISO 8601 time", () => {
    for (const bad of ["", "yesterday", "2026-11-23", "1732385045", "2026-13-45T99:99:99Z", "2026-11-23 18:04:05"]) {
      expect(toConsentTimestamp(bad)).toBeNull();
    }
  });
});
