import { describe, expect, it } from "vitest";
import { parseGaClientId } from "@/lib/gaClientId";

describe("parseGaClientId", () => {
  it("returns the last two parts of a GA1.1 cookie", () => {
    expect(parseGaClientId("GA1.1.1234567890.1731500000")).toBe("1234567890.1731500000");
  });

  it("accepts other domain-depth prefixes", () => {
    expect(parseGaClientId("GA1.2.987654321.1731500000")).toBe("987654321.1731500000");
  });

  it("returns null for a missing or malformed cookie", () => {
    expect(parseGaClientId(undefined)).toBeNull();
    expect(parseGaClientId("")).toBeNull();
    expect(parseGaClientId("GA1.1.abc.def")).toBeNull();
    expect(parseGaClientId("1234567890.1731500000")).toBeNull();
  });
});
