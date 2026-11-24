import { describe, expect, it } from "vitest";
import { landingPath, referringDomain } from "@/lib/referrer";

const OWN = "roadwren-demo.example";

describe("referringDomain", () => {
  it("returns the host name of a referrer from another site", () => {
    expect(referringDomain("https://search.example/results?q=fleet+tracking", OWN)).toBe("search.example");
  });

  it("returns the host name in lower case", () => {
    expect(referringDomain("https://Search.EXAMPLE/Results", OWN)).toBe("search.example");
  });

  it("drops the path, the query string and the port", () => {
    expect(referringDomain("https://assistant.example:8443/chat/123?x=1#y", OWN)).toBe("assistant.example");
  });

  it("is empty when there is no referrer", () => {
    expect(referringDomain("", OWN)).toBe("");
  });

  it("is empty for the site's own domain", () => {
    expect(referringDomain(`https://${OWN}/pricing`, OWN)).toBe("");
  });

  it("is empty for the site's own domain in another letter case", () => {
    expect(referringDomain("https://ROADWREN-demo.example/pricing", OWN)).toBe("");
  });

  it("is empty for the site's own domain with or without www", () => {
    expect(referringDomain(`https://www.${OWN}/`, OWN)).toBe("");
    expect(referringDomain(`https://${OWN}/`, `www.${OWN}`)).toBe("");
  });

  it("keeps a different site that only shares the ending", () => {
    expect(referringDomain("https://other.example/", OWN)).toBe("other.example");
    expect(referringDomain(`https://blog.${OWN}/`, OWN)).toBe(`blog.${OWN}`);
  });

  it("is empty for a referrer that is not a web page", () => {
    expect(referringDomain("android-app://com.mail.example/", OWN)).toBe("");
    expect(referringDomain("not a url", OWN)).toBe("");
  });
});

describe("landingPath", () => {
  it("returns the path", () => {
    expect(landingPath("/pricing")).toBe("/pricing");
  });

  it("is empty for anything that is not a path", () => {
    expect(landingPath("")).toBe("");
    expect(landingPath("pricing")).toBe("");
  });

  it("is cut at 200 characters", () => {
    expect(landingPath("/" + "x".repeat(500))).toHaveLength(200);
  });
});
