import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ATTRIBUTION_COOKIE,
  applyConsent,
  captureLanding,
  readAttribution,
  resetPendingForTests,
} from "@/lib/attribution";

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

// jsdom hides cookie attributes on read, so record every raw write.
let writes: string[] = [];
const native = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;

beforeEach(() => {
  writes = [];
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => native.get!.call(document),
    set: (value: string) => {
      writes.push(value);
      native.set!.call(document, value);
    },
  });
});

afterEach(() => {
  native.set!.call(document, `${ATTRIBUTION_COOKIE}=; Max-Age=0; Path=/`);
  delete (document as { cookie?: string }).cookie;
  resetPendingForTests();
  localStorage.clear();
  sessionStorage.clear();
});

const attributionWrites = () => writes.filter((w) => w.startsWith(`${ATTRIBUTION_COOKIE}=`));

describe("consent gate for click IDs and UTMs", () => {
  it("writes no cookie while ad storage is denied", () => {
    captureLanding("?gclid=TEST123", "denied");
    expect(attributionWrites()).toEqual([]);
    expect(readAttribution()).toEqual({});
  });

  it("writes no cookie before any consent choice", () => {
    captureLanding("?gclid=TEST123", null);
    expect(attributionWrites()).toEqual([]);
    expect(readAttribution()).toEqual({});
  });

  it("writes a 90-day first-party cookie when ad storage is granted", () => {
    captureLanding("?gclid=TEST123&utm_source=google", "granted");

    const [write] = attributionWrites();
    expect(write).toContain(`Max-Age=${NINETY_DAYS_SECONDS}`);
    expect(write).toContain("Path=/");
    expect(write).toContain("SameSite=Lax");
    expect(readAttribution()).toEqual({ gclid: "TEST123", utm_source: "google" });
  });

  it("stores the landing values when consent is granted later in the visit", () => {
    captureLanding("?gclid=TEST123&utm_campaign=spring", null);
    expect(attributionWrites()).toEqual([]);

    applyConsent("granted");

    expect(attributionWrites()).toHaveLength(1);
    expect(readAttribution()).toEqual({ gclid: "TEST123", utm_campaign: "spring" });
  });

  it("holds pending values in memory only, not in web storage", () => {
    captureLanding("?gclid=TEST123", null);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("keeps the stored set when a later landing has no parameters", () => {
    captureLanding("?gclid=FIRST", "granted");
    captureLanding("?plan=pro", "granted");
    expect(readAttribution()).toEqual({ gclid: "FIRST" });
  });

  it("replaces the whole stored set when a later landing has parameters", () => {
    captureLanding("?gclid=FIRST&utm_source=google&utm_campaign=spring", "granted");
    captureLanding("?fbclid=SECOND&utm_source=facebook", "granted");
    expect(readAttribution()).toEqual({ fbclid: "SECOND", utm_source: "facebook" });
  });

  it("deletes the stored cookie when consent is changed to denied", () => {
    captureLanding("?gclid=TEST123", "granted");
    applyConsent("denied");
    expect(readAttribution()).toEqual({});
    expect(attributionWrites().at(-1)).toContain("Max-Age=0");
  });
});
