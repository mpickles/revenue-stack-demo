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

const OWN = "roadwren-demo.example";
const landing = (referrer: string, path = "/pricing") => ({ referrer, host: OWN, path });

describe("consent gate for the referring domain and the landing page", () => {
  it("writes no cookie while ad storage is denied", () => {
    captureLanding("", "denied", landing("https://search.example/"));
    expect(attributionWrites()).toEqual([]);
    expect(readAttribution()).toEqual({});
  });

  it("writes no cookie before any consent choice", () => {
    captureLanding("", null, landing("https://search.example/"));
    expect(attributionWrites()).toEqual([]);
    expect(readAttribution()).toEqual({});
  });

  it("holds them in memory only before consent, not in web storage", () => {
    captureLanding("", null, landing("https://search.example/"));
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("stores both in the 90-day cookie when ad storage is granted", () => {
    captureLanding("", "granted", landing("https://search.example/results?q=fleet"));

    const [write] = attributionWrites();
    expect(write).toContain(`Max-Age=${NINETY_DAYS_SECONDS}`);
    expect(readAttribution()).toEqual({ referring_domain: "search.example", landing_page: "/pricing" });
  });

  it("stores both when consent is granted later in the visit", () => {
    captureLanding("?gclid=TEST123", null, landing("https://search.example/", "/demo"));
    expect(attributionWrites()).toEqual([]);

    applyConsent("granted");

    expect(readAttribution()).toEqual({
      gclid: "TEST123",
      referring_domain: "search.example",
      landing_page: "/demo",
    });
  });

  it("never stores them when the visitor rejects", () => {
    captureLanding("", null, landing("https://search.example/"));
    applyConsent("denied");
    expect(readAttribution()).toEqual({});
    expect(attributionWrites().filter((w) => !w.includes("Max-Age=0"))).toEqual([]);
  });

  it("deletes them when consent is changed to denied", () => {
    captureLanding("", "granted", landing("https://search.example/"));
    applyConsent("denied");
    expect(readAttribution()).toEqual({});
  });

  it("never stores the site's own domain as a referrer", () => {
    captureLanding("", "granted", landing(`https://${OWN}/pricing`, "/demo"));
    expect(readAttribution()).toEqual({ landing_page: "/demo" });
    expect(attributionWrites().join("")).not.toContain(OWN);
  });

  it("never stores the site's own www domain as a referrer", () => {
    captureLanding("?gclid=TEST123", "granted", landing(`https://www.${OWN}/`, "/demo"));
    expect(readAttribution()).toEqual({ gclid: "TEST123", landing_page: "/demo" });
  });

  it("stores the landing page alone for a direct visit when nothing is stored", () => {
    captureLanding("", "granted", landing(""));
    expect(readAttribution()).toEqual({ landing_page: "/pricing" });
  });

  it("keeps the stored set on a later landing with no source", () => {
    captureLanding("?gclid=FIRST", "granted", landing("https://search.example/", "/"));
    captureLanding("?plan=pro", "granted", landing(`https://${OWN}/pricing`, "/demo"));
    captureLanding("", "granted", landing("", "/pricing"));
    expect(readAttribution()).toEqual({ gclid: "FIRST", referring_domain: "search.example", landing_page: "/" });
  });

  it("keeps the stored set when a landing with no source gets consent later", () => {
    captureLanding("?gclid=FIRST", "granted", landing("https://search.example/", "/"));
    captureLanding("", null, landing("", "/pricing"));
    applyConsent("granted");
    expect(readAttribution()).toEqual({ gclid: "FIRST", referring_domain: "search.example", landing_page: "/" });
  });

  it("replaces the whole stored set when a later landing has a referring domain", () => {
    captureLanding("?gclid=FIRST&utm_source=google", "granted", landing("https://search.example/", "/"));
    captureLanding("", "granted", landing("https://assistant.example/chat", "/pricing"));
    expect(readAttribution()).toEqual({ referring_domain: "assistant.example", landing_page: "/pricing" });
  });

  it("replaces the referring domain and landing page when a later landing has a click ID", () => {
    captureLanding("", "granted", landing("https://search.example/", "/"));
    captureLanding("?fbclid=SECOND", "granted", landing("", "/demo"));
    expect(readAttribution()).toEqual({ fbclid: "SECOND", landing_page: "/demo" });
  });

  it("does not read a referring domain or landing page from the query string", () => {
    captureLanding("?referring_domain=fake.example&landing_page=/fake", "granted");
    expect(readAttribution()).toEqual({});
  });
});
