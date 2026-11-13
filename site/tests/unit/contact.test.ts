import { describe, expect, it } from "vitest";
import { contactEmail } from "@/lib/contact";

describe("contactEmail", () => {
  it("returns the address when it looks like an email", () => {
    expect(contactEmail("privacy@roadwren-demo.test")).toBe("privacy@roadwren-demo.test");
  });

  it("trims surrounding spaces", () => {
    expect(contactEmail("  privacy@roadwren-demo.test ")).toBe("privacy@roadwren-demo.test");
  });

  it("returns null when unset, empty or not an email", () => {
    expect(contactEmail(undefined)).toBeNull();
    expect(contactEmail("")).toBeNull();
    expect(contactEmail("YOUR-NEW-ADDRESS")).toBeNull();
    expect(contactEmail("a@b")).toBeNull();
  });
});
