import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AttributionCapture } from "@/components/AttributionCapture";
import { HiddenAttributionFields } from "@/components/HiddenAttributionFields";
import { applyConsent, resetPendingForTests } from "@/lib/attribution";
import { setConsent } from "@/lib/consent";
import { HIDDEN_FIELD_NAMES } from "@/lib/hiddenFields";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const GA_COOKIE = "GA1.1.1234567890.1731500000";
const ATTRIB = encodeURIComponent(JSON.stringify({ gclid: "TEST123", utm_source: "google" }));

let container: HTMLDivElement;
let root: Root;

function clearCookies() {
  for (const name of ["rw_consent", "rw_attrib", "_ga"]) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

beforeEach(() => {
  clearCookies();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  clearCookies();
  resetPendingForTests();
  window.history.replaceState(null, "", "/");
  delete (document as { referrer?: string }).referrer;
});

// jsdom has no referrer. This stands in for arriving from another page.
function arriveFrom(referrer: string) {
  Object.defineProperty(document, "referrer", { configurable: true, get: () => referrer });
}

// What the banner does on a click, without rendering it.
function choose(choice: "granted" | "denied") {
  window.dataLayer = window.dataLayer ?? [];
  setConsent(choice);
  applyConsent(choice);
}

const LandedForm = () => (
  <>
    <TestForm />
    <AttributionCapture />
  </>
);

function render(ui: React.ReactNode) {
  act(() => root.render(ui));
  return container.querySelector("form")!;
}

// Submits the way a browser does and captures what the form carries.
function submit(form: HTMLFormElement): Record<string, string> {
  let carried: Record<string, string> = {};
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    carried = Object.fromEntries(new FormData(form)) as Record<string, string>;
  });
  act(() => form.requestSubmit());
  return carried;
}

const TestForm = () => (
  <form>
    <HiddenAttributionFields />
  </form>
);

describe("HiddenAttributionFields", () => {
  it("renders one hidden input per field", () => {
    const form = render(<TestForm />);
    const names = [...form.querySelectorAll('input[type="hidden"]')].map((i) => i.getAttribute("name"));
    expect(names).toEqual([...HIDDEN_FIELD_NAMES]);
  });

  it("reads cookies at submit time, not at first render", () => {
    const form = render(<TestForm />);
    // Cookies appear after render, as they do when capture runs after hydration.
    document.cookie = "rw_consent=granted; Path=/";
    document.cookie = `rw_attrib=${ATTRIB}; Path=/`;
    document.cookie = `_ga=${GA_COOKIE}; Path=/`;

    const carried = submit(form);
    expect(carried.gclid).toBe("TEST123");
    expect(carried.utm_source).toBe("google");
    expect(carried.ga_client_id).toBe("1234567890.1731500000");
  });

  it("carries the gclid on a submit right after landing with consent already granted", () => {
    document.cookie = "rw_consent=granted; Path=/";
    window.history.replaceState(null, "", "/demo?gclid=TEST123");

    // Same order as app/layout.tsx: page content first, AttributionCapture
    // last, so the form's effects run before the capture does.
    const form = render(
      <>
        <TestForm />
        <AttributionCapture />
      </>,
    );
    const carried = submit(form);
    expect(carried.gclid).toBe("TEST123");
  });

  it("fills the values before a React onSubmit handler reads them", () => {
    let seen: Record<string, string> = {};
    const form = render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          seen = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
        }}
      >
        <HiddenAttributionFields />
      </form>,
    );
    document.cookie = "rw_consent=granted; Path=/";
    document.cookie = `rw_attrib=${ATTRIB}; Path=/`;

    act(() => form.requestSubmit());
    expect(seen.gclid).toBe("TEST123");
  });

  it("leaves every field empty while consent is denied", () => {
    const form = render(<TestForm />);
    document.cookie = "rw_consent=denied; Path=/";
    document.cookie = `rw_attrib=${ATTRIB}; Path=/`;
    document.cookie = `_ga=${GA_COOKIE}; Path=/`;

    const carried = submit(form);
    for (const name of HIDDEN_FIELD_NAMES) expect(carried[name]).toBe("");
  });

  it("leaves every field empty before any consent choice", () => {
    const form = render(<TestForm />);
    document.cookie = `rw_attrib=${ATTRIB}; Path=/`;
    document.cookie = `_ga=${GA_COOKIE}; Path=/`;

    const carried = submit(form);
    for (const name of HIDDEN_FIELD_NAMES) expect(carried[name]).toBe("");
  });

  it("clears a value on a later submit after consent is withdrawn", () => {
    const form = render(<TestForm />);
    document.cookie = "rw_consent=granted; Path=/";
    document.cookie = `rw_attrib=${ATTRIB}; Path=/`;
    expect(submit(form).gclid).toBe("TEST123");

    document.cookie = "rw_consent=denied; Path=/";
    expect(submit(form).gclid).toBe("");
  });
});

describe("referring domain and landing page in the hidden fields", () => {
  it("are empty before any consent choice", () => {
    arriveFrom("https://search.example/results?q=fleet");
    window.history.replaceState(null, "", "/pricing");
    const form = render(<LandedForm />);

    const carried = submit(form);
    expect(carried.referring_domain).toBe("");
    expect(carried.landing_page).toBe("");
  });

  it("are present after the visitor accepts", () => {
    arriveFrom("https://Search.Example/results?q=fleet");
    window.history.replaceState(null, "", "/pricing?plan=pro");
    const form = render(<LandedForm />);
    expect(submit(form).referring_domain).toBe("");

    choose("granted");

    const carried = submit(form);
    expect(carried.referring_domain).toBe("search.example");
    expect(carried.landing_page).toBe("/pricing");
  });

  it("stay empty after the visitor rejects", () => {
    arriveFrom("https://search.example/");
    window.history.replaceState(null, "", "/pricing");
    const form = render(<LandedForm />);

    choose("denied");

    const carried = submit(form);
    expect(carried.referring_domain).toBe("");
    expect(carried.landing_page).toBe("");
  });

  it("are cleared on a later submit after consent is withdrawn", () => {
    arriveFrom("https://search.example/");
    const form = render(<LandedForm />);
    choose("granted");
    expect(submit(form).referring_domain).toBe("search.example");

    choose("denied");
    const carried = submit(form);
    expect(carried.referring_domain).toBe("");
    expect(carried.landing_page).toBe("");
  });

  it("never carry the site's own domain as a referrer", () => {
    arriveFrom(`${window.location.origin}/pricing`);
    window.history.replaceState(null, "", "/demo");
    const form = render(<LandedForm />);
    choose("granted");

    const carried = submit(form);
    expect(carried.referring_domain).toBe("");
    expect(carried.landing_page).toBe("/demo");
  });
});
