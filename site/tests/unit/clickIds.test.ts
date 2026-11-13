import { describe, expect, it } from "vitest";
import { ATTRIBUTION_KEYS, parseClickIds } from "@/lib/clickIds";

describe("parseClickIds", () => {
  it("reads all six click IDs and all five UTM parameters", () => {
    const search =
      "?gclid=g1&gbraid=gb1&wbraid=wb1&fbclid=fb1&li_fat_id=li1&msclkid=ms1" +
      "&utm_source=google&utm_medium=cpc&utm_campaign=spring&utm_term=fleet+tracking&utm_content=ad_a";

    expect(parseClickIds(search)).toEqual({
      gclid: "g1",
      gbraid: "gb1",
      wbraid: "wb1",
      fbclid: "fb1",
      li_fat_id: "li1",
      msclkid: "ms1",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring",
      utm_term: "fleet tracking",
      utm_content: "ad_a",
    });
  });

  it("covers exactly the eleven keys in the spec", () => {
    expect([...ATTRIBUTION_KEYS].sort()).toEqual(
      [
        "gclid", "gbraid", "wbraid", "fbclid", "li_fat_id", "msclkid",
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      ].sort(),
    );
  });

  it("ignores parameters that are not on the list", () => {
    expect(parseClickIds("?gclid=TEST123&plan=pro&ref=x&utm_id=9")).toEqual({ gclid: "TEST123" });
  });

  it("drops empty values", () => {
    expect(parseClickIds("?gclid=&utm_source=%20&fbclid=f1")).toEqual({ fbclid: "f1" });
  });

  it("returns an empty object when there are no parameters", () => {
    expect(parseClickIds("")).toEqual({});
    expect(parseClickIds("?")).toEqual({});
  });

  it("URL-decodes values", () => {
    expect(parseClickIds("?utm_campaign=q4%20fleets%2Fsouth&gclid=a%2Bb")).toEqual({
      utm_campaign: "q4 fleets/south",
      gclid: "a+b",
    });
  });
});
