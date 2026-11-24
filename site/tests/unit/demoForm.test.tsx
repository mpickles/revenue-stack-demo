import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoForm } from "@/app/demo/DemoForm";
import { AttributionCapture } from "@/components/AttributionCapture";
import { ConsentBanner } from "@/components/ConsentBanner";
import { resetPendingForTests } from "@/lib/attribution";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const EMAIL = "dana.fake@example-fleet.test";

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

function clearCookies() {
  for (const name of ["rw_consent", "rw_consent_at", "rw_attrib", "_ga"]) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

beforeEach(() => {
  clearCookies();
  window.dataLayer = [];
  routerPush.mockClear();
  fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, delivered: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(document, "referrer", { configurable: true, get: () => "https://search.example/results" });
  window.history.replaceState(null, "", "/demo?gclid=TEST123&utm_medium=cpc");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  clearCookies();
  resetPendingForTests();
  vi.unstubAllGlobals();
  delete (document as { referrer?: string }).referrer;
  window.history.replaceState(null, "", "/");
});

// Same order as app/layout.tsx: the page, then the banner, then the capture.
function renderPage() {
  act(() =>
    root.render(
      <>
        <DemoForm plan="pro" />
        <ConsentBanner />
        <AttributionCapture />
      </>,
    ),
  );
}

const banner = () => container.querySelector('[role="dialog"]');

function clickBanner(label: "Accept all" | "Reject all") {
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent === label)!;
  act(() => button.click());
}

function setField(name: string, value: string) {
  const field = container.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
  field.value = value;
}

async function fillAndSubmit(): Promise<Record<string, unknown>> {
  setField("first_name", "Dana");
  setField("last_name", "Fake");
  setField("email", " Dana.Fake@Example-Fleet.test ");
  setField("company", "Example Fleet Co");
  setField("fleet_size", "50-199");
  await act(async () => container.querySelector("form")!.requestSubmit());
  await vi.waitFor(() => expect(routerPush).toHaveBeenCalledWith("/thanks"));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/lead");
  return JSON.parse(init.body as string);
}

const generateLeadPushes = () =>
  window.dataLayer.filter((entry) => (entry as { event?: string })?.event === "generate_lead");

describe("the /demo form", () => {
  it("has a required fleet size select with the six bands", () => {
    renderPage();
    const select = container.querySelector<HTMLSelectElement>("select#fleet_size")!;
    expect(select.name).toBe("fleet_size");
    expect(select.required).toBe(true);
    expect(container.querySelector('label[for="fleet_size"]')!.textContent).toBe("Fleet size (vehicles)");
    const options = [...select.options].filter((o) => !o.disabled).map((o) => o.value);
    expect(options).toEqual(["1-19", "20-49", "50-199", "200-499", "500-999", "1,000+"]);
    expect(container.querySelector('[name="employees"]')).toBeNull();
  });

  it("does not send the form while no fleet size is chosen", async () => {
    renderPage();
    clickBanner("Accept all");
    setField("first_name", "Dana");
    setField("last_name", "Fake");
    setField("email", EMAIL);
    setField("company", "Example Fleet Co");
    await act(async () => container.querySelector("form")!.requestSubmit());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });
});

describe("the /api/lead payload from the /demo form", () => {
  it("on the accept path carries the consent values, the click ID, the referrer and the landing page", async () => {
    renderPage();
    clickBanner("Accept all");
    const payload = await fillAndSubmit();

    expect(payload).toMatchObject({
      form_id: "demo",
      plan: "pro",
      first_name: "Dana",
      last_name: "Fake",
      company: "Example Fleet Co",
      fleet_size: "50-199",
      gclid: "TEST123",
      utm_medium: "cpc",
      referring_domain: "search.example",
      landing_page: "/demo",
      ad_user_data_consent: true,
      ad_personalization_consent: true,
    });
    expect(payload.ad_consent_timestamp).toMatch(ISO_UTC);
    expect(payload).not.toHaveProperty("employees");
  });

  it("on the reject path still sends the lead, with both consent values false and the time of the choice", async () => {
    renderPage();
    clickBanner("Reject all");
    const payload = await fillAndSubmit();

    expect(payload).toMatchObject({
      form_id: "demo",
      first_name: "Dana",
      fleet_size: "50-199",
      ad_user_data_consent: false,
      ad_personalization_consent: false,
    });
    expect(payload.ad_consent_timestamp).toMatch(ISO_UTC);
    // Nothing behind the consent gate leaves the browser.
    for (const name of ["gclid", "utm_medium", "referring_domain", "landing_page", "ga_client_id"]) {
      expect(payload[name]).toBe("");
    }
    expect(document.cookie).not.toContain("rw_attrib");
  });

  it("before any choice sends both consent values false, no time, and nothing behind the gate", async () => {
    renderPage();
    const payload = await fillAndSubmit();

    expect(payload.ad_user_data_consent).toBe(false);
    expect(payload.ad_personalization_consent).toBe(false);
    expect(payload.ad_consent_timestamp).toBe("");
    for (const name of ["gclid", "utm_medium", "referring_domain", "landing_page", "ga_client_id"]) {
      expect(payload[name]).toBe("");
    }
  });

  it("reads the consent values at submit time, after a change of mind", async () => {
    renderPage();
    clickBanner("Accept all");
    act(() => window.dispatchEvent(new Event("rw:consent-open")));
    clickBanner("Reject all");
    const payload = await fillAndSubmit();

    expect(payload.ad_user_data_consent).toBe(false);
    expect(payload.ad_personalization_consent).toBe(false);
    expect(payload.gclid).toBe("");
    expect(payload.referring_domain).toBe("");
  });

  it("never sends the site's own domain as a referrer", async () => {
    Object.defineProperty(document, "referrer", {
      configurable: true,
      get: () => `${window.location.origin}/pricing`,
    });
    renderPage();
    clickBanner("Accept all");
    const payload = await fillAndSubmit();

    expect(payload.referring_domain).toBe("");
    expect(payload.landing_page).toBe("/demo");
    expect(JSON.stringify(payload)).not.toContain(window.location.hostname);
  });
});

describe("the data layer contract on /demo", () => {
  it.each(["Accept all", "Reject all"] as const)(
    "generate_lead pushes form_id, form_type and plan and nothing new after %s",
    async (label) => {
      renderPage();
      clickBanner(label);
      await fillAndSubmit();

      expect(generateLeadPushes()).toEqual([
        {
          event: "generate_lead",
          form_id: "demo",
          form_type: "custom",
          plan: "pro",
          user_data: { email: EMAIL },
        },
      ]);
    },
  );
});

describe("the consent banner and the time of the choice", () => {
  it("stays closed for a saved choice that has a saved time", () => {
    document.cookie = "rw_consent=denied; Path=/";
    document.cookie = `rw_consent_at=${encodeURIComponent("2026-11-23T18:04:05.000Z")}; Path=/`;
    renderPage();
    expect(banner()).toBeNull();
  });

  it.each(["granted", "denied"])("stays closed for a saved %s choice that has no saved time", (choice) => {
    document.cookie = `rw_consent=${choice}; Path=/`;
    renderPage();
    expect(banner()).toBeNull();
  });

  it("sends a saved choice with no saved time as the saved booleans and an empty timestamp", async () => {
    document.cookie = "rw_consent=granted; Path=/";
    renderPage();
    const payload = await fillAndSubmit();

    expect(payload.ad_user_data_consent).toBe(true);
    expect(payload.ad_personalization_consent).toBe(true);
    expect(payload.ad_consent_timestamp).toBe("");
    // The saved choice still applies to the consent gate.
    expect(payload.gclid).toBe("TEST123");
    expect(document.cookie).not.toContain("rw_consent_at");
  });

  it("opens when there is no saved choice", () => {
    renderPage();
    expect(banner()).not.toBeNull();
  });
});
