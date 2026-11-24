// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/lead/route";
import { FLEET_SIZE_BANDS } from "@/lib/fleetSize";

const EMAIL = "Dana.Fake@Example-Fleet.test";

const validLead = (overrides: Record<string, unknown> = {}) => ({
  form_id: "demo",
  first_name: "Dana",
  last_name: "Fake",
  email: EMAIL,
  company: "Example Fleet Co",
  fleet_size: "50-199",
  plan: "pro",
  gclid: "TEST123",
  utm_source: "google",
  fbclid: "",
  ga_client_id: "1234567890.1731500000",
  ...overrides,
});

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

let logged: string[] = [];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  logged = [];
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
  }
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  delete process.env.HUBSPOT_TOKEN;
});

afterEach(() => {
  // No test may ever log an email address, in any case.
  for (const line of logged) {
    expect(line.toLowerCase()).not.toContain(EMAIL.toLowerCase());
    expect(line).not.toContain("@");
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.HUBSPOT_TOKEN;
});

describe("POST /api/lead without HUBSPOT_TOKEN", () => {
  it("validates, does not call HubSpot, logs one line and says not delivered", async () => {
    const res = await post(validLead());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, delivered: false, reason: "hubspot_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logged).toHaveLength(1);
  });
});

describe("POST /api/lead validation", () => {
  it("rejects a malformed email", async () => {
    const res = await post(validLead({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual(["email"]);
  });

  it("lists every missing required field", async () => {
    const res = await post({ form_id: "demo" });
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual(["first_name", "last_name", "email", "company", "fleet_size"]);
  });

  it("has exactly the six fleet size bands from the company brief", () => {
    expect([...FLEET_SIZE_BANDS]).toEqual(["1-19", "20-49", "50-199", "200-499", "500-999", "1,000+"]);
  });

  it.each([...FLEET_SIZE_BANDS])("accepts the fleet size band %s", async (band) => {
    const res = await post(validLead({ fleet_size: band }));
    expect(res.status).toBe(200);
  });

  it("rejects a fleet size value that is not on the list", async () => {
    const res = await post(validLead({ fleet_size: "lots" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual(["fleet_size"]);
  });

  it.each(["1000+", "1-49", "5000+", "20", "", 50])("rejects the fleet size %j", async (value) => {
    const res = await post(validLead({ fleet_size: value }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual(["fleet_size"]);
  });

  it("rejects a lead that still sends employees and no fleet size", async () => {
    const { fleet_size: _omit, ...old } = validLead();
    const res = await post({ ...old, employees: "50-199" });
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual(["fleet_size"]);
  });

  it("sends the 1,000+ band to HubSpot exactly as written", async () => {
    process.env.HUBSPOT_TOKEN = "fake-token-for-tests";
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await post(validLead({ fleet_size: "1,000+" }));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const { properties } = JSON.parse(init.body as string).inputs[0];
    expect(properties.fleet_size).toBe("1,000+");
    expect(properties).not.toHaveProperty("employees");
  });

  it("rejects a plan that is not core, pro or enterprise", async () => {
    const res = await post(validLead({ plan: "gold" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual(["plan"]);
  });

  it("accepts a missing or null plan", async () => {
    const { plan: _omit, ...noPlan } = validLead();
    expect((await post(noPlan)).status).toBe(200);
    expect((await post(validLead({ plan: null }))).status).toBe(200);
  });

  it("rejects an unknown form_id", async () => {
    const res = await post(validLead({ form_id: "other" }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual(["form_id"]);
  });

  it("rejects a hidden field that is too long", async () => {
    const res = await post(validLead({ gclid: "x".repeat(501) }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual(["gclid"]);
  });

  it("rejects a body that is not JSON", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, errors: ["body"] });
  });

  it("does not echo the email back in an error response", async () => {
    const res = await post(validLead({ email: "bad@" }));
    expect(await res.text()).not.toContain("bad@");
  });
});

describe("POST /api/lead with HUBSPOT_TOKEN", () => {
  beforeEach(() => {
    process.env.HUBSPOT_TOKEN = "fake-token-for-tests";
  });

  it("upserts the contact on email and reports delivered", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "COMPLETE", results: [{}] }), { status: 200 }));

    const res = await post(validLead());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, delivered: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer fake-token-for-tests");

    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      inputs: [
        {
          idProperty: "email",
          id: "dana.fake@example-fleet.test",
          properties: {
            email: "dana.fake@example-fleet.test",
            firstname: "Dana",
            lastname: "Fake",
            company: "Example Fleet Co",
            fleet_size: "50-199",
            plan: "pro",
            form_id: "demo",
            gclid: "TEST123",
            utm_source: "google",
            ga_client_id: "1234567890.1731500000",
          },
        },
      ],
    });
  });

  it("returns 502 and logs only the status when HubSpot fails", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: `Contact ${EMAIL} already exists` }), { status: 500 }),
    );
    const res = await post(validLead());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, delivered: false, reason: "crm_error" });
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("500");
  });

  it("treats a 207 multi-status as not delivered", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "COMPLETE", errors: [{}] }), { status: 207 }));
    const res = await post(validLead());
    expect(res.status).toBe(502);
  });

  it("returns 502 when the request to HubSpot throws", async () => {
    fetchMock.mockRejectedValue(new TypeError(`fetch failed for ${EMAIL}`));
    const res = await post(validLead());
    expect(res.status).toBe(502);
    expect(logged).toHaveLength(1);
  });
});
