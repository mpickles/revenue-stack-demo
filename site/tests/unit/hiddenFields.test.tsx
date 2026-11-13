import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AttributionCapture } from "@/components/AttributionCapture";
import { HiddenAttributionFields } from "@/components/HiddenAttributionFields";
import { resetPendingForTests } from "@/lib/attribution";
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
});

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
